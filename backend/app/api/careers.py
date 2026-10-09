"""
Prijave za posao (stranica O nama): javni upitnik sa CV-om i pregled prijava za admina.
"""

import html
import re
from datetime import datetime
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, TypeAdapter, ValidationError
from sqlalchemy.orm import Session

from app.api.prep import SlidingWindowLimiter
from app.core.config import settings
from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models.admin import Admin
from app.models.job_application import JobApplication
from app.services.attachment_service import (
    delete_booking_attachment_file,
    resolve_attachment_path,
    save_booking_attachment,
    validate_attachment_upload,
)
from app.services.email_service import send_email

logger = logging.getLogger("brainstorm.careers")

router = APIRouter(tags=["Prijave za posao"])

DEGREES = ["Student", "Osnovne studije", "Master studije", "Doktorske studije", "Drugo"]
EXPERIENCE = ["Bez iskustva", "Do godinu dana", "1 do 3 godine", "Više od 3 godine"]
CV_MIME = {".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}

# Zaštita od spama: najviše 5 prijava sa jedne IP adrese na sat.
application_limiter = SlidingWindowLimiter()


class JobApplicationResponse(BaseModel):
    id: int
    full_name: str
    email: Optional[str] = None
    phone: str
    degree: str
    subjects: str
    experience: Optional[str] = None
    about: Optional[str] = None
    cv_original_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


def _bad(detail: str):
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


def _clean(value: Optional[str], limit: int, label: str, required: bool = False) -> Optional[str]:
    value = (value or "").strip()
    if required and not value:
        _bad(f"Polje „{label}” je obavezno.")
    if len(value) > limit:
        _bad(f"Polje „{label}” može imati najviše {limit} znakova.")
    return value or None


@router.post("/public/job-applications", status_code=status.HTTP_201_CREATED)
def create_job_application(
    request: Request,
    full_name: str = Form(...),
    phone: str = Form(...),
    degree: str = Form(...),
    subjects: str = Form(...),
    email: Optional[str] = Form(None),
    experience: Optional[str] = Form(None),
    about: Optional[str] = Form(None),
    cv: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Kandidat šalje upitnik i CV. Prijava se čuva, a centar dobija email sa CV-om u prilogu."""
    full_name = _clean(full_name, 120, "Ime i prezime", required=True)
    if len(full_name) < 2:
        _bad("Unesi ime i prezime.")
    phone = _clean(phone, 40, "Broj telefona", required=True)
    if len(re.sub(r"\D", "", phone)) < 6:
        _bad("Unesi ispravan broj telefona.")
    email = _clean(email, 255, "Email")
    if email:
        try:
            email = str(TypeAdapter(EmailStr).validate_python(email))
        except ValidationError:
            _bad("Unesi ispravnu email adresu.")
    if degree not in DEGREES:
        _bad("Izaberi stručnu spremu.")
    subjects = _clean(subjects, 400, "Predmeti", required=True)
    experience = _clean(experience, 60, "Iskustvo")
    if experience and experience not in EXPERIENCE:
        _bad("Izaberi iskustvo iz ponuđenih opcija.")
    about = _clean(about, 3000, "Nešto o tebi")

    client_ip = request.client.host if request.client else "unknown"
    if not application_limiter.allow(client_ip, 5, 3600):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Poslato je previše prijava. Pokušaj ponovo kasnije.")

    content, original_name, ext = validate_attachment_upload(cv)
    stored = save_booking_attachment("cv", content, ext)
    application = JobApplication(
        full_name=full_name, email=email, phone=phone, degree=degree, subjects=subjects,
        experience=experience, about=about, cv_stored_name=stored, cv_original_name=original_name,
    )
    try:
        db.add(application)
        db.commit()
    except Exception:
        db.rollback()
        delete_booking_attachment_file(stored)
        raise
    db.refresh(application)

    rows = [("Ime i prezime", full_name), ("Telefon", phone), ("Email", email or "-"), ("Stručna sprema", degree),
            ("Predmeti", subjects), ("Iskustvo", experience or "-"), ("O sebi", about or "-")]
    table = "".join(f"<tr><td style='padding:6px 12px 6px 0;color:#7c817a'>{html.escape(k)}</td><td style='padding:6px 0'>{html.escape(v)}</td></tr>" for k, v in rows)
    send_email(
        to=settings.ADMIN_EMAIL,
        subject=f"Prijava za posao: {full_name}",
        html_body=f"<h2>Nova prijava za posao</h2><table>{table}</table><p>CV je u prilogu i u admin panelu, kartica „Prijave”.</p>",
        attachments=[(original_name, content, CV_MIME[ext])],
    )
    return {"id": application.id}


@router.get("/admin/job-applications", response_model=List[JobApplicationResponse])
def list_job_applications(db: Session = Depends(get_db), _admin: Admin = Depends(get_current_admin)):
    return db.query(JobApplication).order_by(JobApplication.created_at.desc()).all()


@router.get("/admin/job-applications/{application_id}/cv")
def download_job_application_cv(application_id: int, db: Session = Depends(get_db), _admin: Admin = Depends(get_current_admin)):
    application = db.get(JobApplication, application_id)
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prijava nije pronađena.")
    path = resolve_attachment_path(application.cv_stored_name)
    return FileResponse(path, filename=application.cv_original_name, media_type="application/octet-stream")
