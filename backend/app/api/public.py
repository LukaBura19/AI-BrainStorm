import secrets
import logging
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.booking import Booking
from app.models.booking_attachment import BookingAttachment
from app.models.subject import Subject
from app.models.teacher import Teacher
from app.models.teacher_availability import TeacherAvailability
from app.models.teacher_subject import TeacherSubject
from app.schemas.booking import (
    BookingCancelPreviewResponse,
    BookingCancelRequest,
    BookingCancelResponse,
    BookingCreate,
    BookingResponse,
    attachments_from_booking,
)
from app.schemas.subject import SubjectListResponse
from app.schemas.slot import AvailableSlotsResponse
from app.schemas.teacher import (
    SubjectBrief,
    TeacherPublicListResponse,
    TeacherPublicResponse,
)
from app.core.config import settings
from app.services.availability_service import get_available_slots
from app.services.attachment_service import (
    delete_booking_attachment_file,
    save_booking_attachment,
    validate_attachment_upload,
)
from app.services.classroom_service import assign_classroom
from app.utils.datetime_utils import local_today, normalize_to_utc, to_app_timezone
from app.services.email_service import (
    booking_to_email_data,
    send_booking_confirmation,
    send_cancellation_notification,
    send_late_cancellation_notice,
)

logger = logging.getLogger("brainstorm.public")

# Konstanta za advisory lock (booking kreiranje)
BOOKING_ADVISORY_LOCK_ID = 737_001  # Jedinstveni ID za booking operacije

router = APIRouter(prefix="/public", tags=["Public"])


def _parse_start_time_form(value: str) -> datetime:
    """Parsira ISO string iz multipart forme u aware datetime."""
    s = (value or "").strip()
    if not s:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nedostaje vreme početka časa.",
        )
    if s.endswith("Z") and "+00:00" not in s:
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Neispravan format vremena početka.",
        )
    return normalize_to_utc(dt)


@router.get("/subjects", response_model=SubjectListResponse)
def list_active_subjects(db: Session = Depends(get_db)):
    """Lista samo aktivnih predmeta. Javni endpoint — bez autentikacije."""
    subjects = (
        db.query(Subject)
        .filter(Subject.is_active == True)  # noqa: E712
        .order_by(Subject.name)
        .all()
    )
    return SubjectListResponse(items=subjects, total=len(subjects))


@router.get("/teachers", response_model=TeacherPublicListResponse)
def list_active_teachers(
    subject_id: Optional[int] = Query(None, description="Filtriraj po predmetu"),
    db: Session = Depends(get_db),
):
    """
    Lista aktivnih i odobrenih profesora. Javni endpoint.
    Opcionalno filtriranje po predmetu (subject_id).
    """
    query = (
        db.query(Teacher)
        .filter(
            Teacher.is_active == True,   # noqa: E712
            Teacher.is_approved == True,  # noqa: E712
        )
    )

    if subject_id is not None:
        query = query.join(TeacherSubject).filter(
            TeacherSubject.subject_id == subject_id
        )

    teachers = query.order_by(Teacher.full_name).all()

    items = []
    for teacher in teachers:
        subjects = [
            SubjectBrief(id=ts.subject.id, name=ts.subject.name)
            for ts in teacher.teacher_subjects
            if ts.subject is not None and ts.subject.is_active
        ]
        items.append(
            TeacherPublicResponse(
                id=teacher.id,
                full_name=teacher.full_name,
                subjects=subjects,
            )
        )

    return TeacherPublicListResponse(items=items, total=len(items))


# =============================================
#  Javni — Dostupni termini
# =============================================

@router.get("/available-slots", response_model=AvailableSlotsResponse)
def list_available_slots(
    teacher_id: int = Query(..., description="ID profesora"),
    date: date = Query(..., description="Datum (YYYY-MM-DD)"),
    duration: int = Query(..., description="Trajanje časa u minutima (45, 60, 90)"),
    delivery_mode: str = Query(
        "in_person",
        description="in_person — traži termine uzimajući u obzir učionice; online — samo raspoloživost profesora",
    ),
    db: Session = Depends(get_db),
):
    """
    Vraća dostupne termine za profesora na zadati datum.

    Uzima u obzir:
      - raspoloživost profesora
      - već postojeće rezervacije profesora
      - globalni kapacitet učionica (max 2 simultana časa)

    Javni endpoint — bez autentikacije.
    """
    if date < local_today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nije moguće prikazati termine za datum koji je prošao.",
        )

    # Validacija trajanja
    if duration not in (45, 60, 90):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trajanje časa mora biti 45, 60 ili 90 minuta.",
        )

    if delivery_mode not in ("online", "in_person"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parametar delivery_mode mora biti 'online' ili 'in_person'.",
        )

    # Provera da profesor postoji i da je aktivan/odobren
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor nije pronađen.",
        )
    if not teacher.is_active or not teacher.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profesor nije aktivan ili odobren.",
        )

    # Izračunaj dostupne termine
    slots = get_available_slots(
        db=db,
        teacher_id=teacher_id,
        target_date=date,
        duration=duration,
        delivery_mode=delivery_mode,
    )

    return AvailableSlotsResponse(
        teacher_id=teacher_id,
        date=date.isoformat(),
        duration=duration,
        slots=slots,
        total=len(slots),
    )


# =============================================
#  Javni — Kreiranje rezervacije
# =============================================

@router.post("/bookings", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    subject_id: int = Form(...),
    teacher_id: int = Form(...),
    start_time: str = Form(..., description="ISO 8601 početak časa"),
    duration: int = Form(...),
    client_full_name: str = Form(...),
    client_email: str = Form(...),
    client_category: str = Form(...),
    client_note: Optional[str] = Form(None),
    delivery_mode: str = Form("in_person"),
    session_type: str = Form("individual"),
    attachments: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db),
):
    """
    Kreira novu rezervaciju časa (multipart/form-data). Javni endpoint — bez autentikacije.

    Opcioni prilozi: PDF, JPG, PNG ili WEBP (do MAX_BOOKING_ATTACHMENTS fajlova, veličina po konfiguraciji).

    Validacije:
      1. Predmet postoji i aktivan je
      2. Profesor postoji, aktivan je i odobren
      3. Profesor predaje dati predmet
      4. Termin je unutar profesorove raspoloživosti
      5. Termin se ne preklapa sa drugom rezervacijom istog profesora
      6. Globalni kapacitet učionica nije popunjen
      7. Dodeljuje se učionica (1 pa 2)
      8. Generiše se token za klijentsko otkazivanje
    """
    files_in = [f for f in (attachments or []) if f.filename]
    if len(files_in) > settings.MAX_BOOKING_ATTACHMENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Najviše {settings.MAX_BOOKING_ATTACHMENTS} priloga po rezervaciji.",
        )
    prepared_attachments = [validate_attachment_upload(f) for f in files_in]

    start_dt = _parse_start_time_form(start_time)
    client_note_clean = (client_note or "").strip() or None
    try:
        payload = BookingCreate(
            subject_id=subject_id,
            teacher_id=teacher_id,
            start_time=start_dt,
            duration=duration,
            client_full_name=client_full_name.strip(),
            client_email=client_email.strip(),
            client_category=client_category,
            client_note=client_note_clean,
            delivery_mode=delivery_mode,
            session_type=session_type,
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=jsonable_encoder(e.errors()),
        )

    # Izračunaj end_time
    end_time = payload.start_time + timedelta(minutes=payload.duration)

    if payload.start_time <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nije moguće zakazati čas u terminu koji je prošao.",
        )

    # --------------------------------------------------
    # 1. Predmet postoji i aktivan je
    # --------------------------------------------------
    subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Predmet nije pronađen.",
        )
    if not subject.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Predmet nije aktivan.",
        )

    # --------------------------------------------------
    # 2. Profesor postoji, aktivan je i odobren
    # --------------------------------------------------
    teacher = db.query(Teacher).filter(Teacher.id == payload.teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor nije pronađen.",
        )
    if not teacher.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profesor nije aktivan.",
        )
    if not teacher.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profesor nije odobren.",
        )

    # --------------------------------------------------
    # 3. Profesor predaje dati predmet
    # --------------------------------------------------
    teaches_subject = (
        db.query(TeacherSubject)
        .filter(
            TeacherSubject.teacher_id == payload.teacher_id,
            TeacherSubject.subject_id == payload.subject_id,
        )
        .first()
    )
    if not teaches_subject:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profesor ne predaje izabrani predmet.",
        )

    # --------------------------------------------------
    # 4. Termin je unutar profesorove raspoloživosti
    # --------------------------------------------------
    availability_match = (
        db.query(TeacherAvailability)
        .filter(
            TeacherAvailability.teacher_id == payload.teacher_id,
            TeacherAvailability.is_available == True,  # noqa: E712
            TeacherAvailability.start_time <= payload.start_time,
            TeacherAvailability.end_time >= end_time,
        )
        .first()
    )
    if not availability_match:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Traženi termin nije unutar raspoloživosti profesora.",
        )

    # ==========================================================
    # KRITIČNA SEKCIJA — zaštita od race conditions
    #
    # PostgreSQL Advisory Lock serijalizuje sve booking zahteve
    # koji se izvršavaju istovremeno. Lock se automatski otpušta
    # kada se transakcija commituje ili rollbackuje.
    #
    # FOR UPDATE zaključava postojeće redove u bookings tabeli
    # tako da drugi zahtev ne može pročitati "stale" podatke.
    # ==========================================================
    db.execute(
        text("SELECT pg_advisory_xact_lock(:lock_id)"),
        {"lock_id": BOOKING_ADVISORY_LOCK_ID},
    )

    # --------------------------------------------------
    # 5. Termin se ne preklapa sa postojećom rezervacijom profesora
    #    (FOR UPDATE zaključava preklapajuće bookinge)
    # --------------------------------------------------
    teacher_conflict = (
        db.query(Booking)
        .filter(
            Booking.teacher_id == payload.teacher_id,
            Booking.status == "confirmed",
            Booking.start_time < end_time,
            Booking.end_time > payload.start_time,
        )
        .with_for_update()
        .first()
    )
    if teacher_conflict:
        conflict_start = to_app_timezone(teacher_conflict.start_time)
        conflict_end = to_app_timezone(teacher_conflict.end_time)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Profesor već ima zakazan čas u periodu "
                f"{conflict_start.strftime('%H:%M')}—"
                f"{conflict_end.strftime('%H:%M')}."
            ),
        )

    # --------------------------------------------------
    # 6 & 7. Dodela učionice (FOR UPDATE na preklapajućim bookingima)
    # --------------------------------------------------
    classroom = assign_classroom(
        db,
        payload.start_time,
        end_time,
        lock_rows=True,
        delivery_mode=payload.delivery_mode,
    )
    if classroom is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Obe učionice su zauzete u traženom terminu. Molimo izaberite drugi termin.",
        )

    # --------------------------------------------------
    # 8. Generisanje cancel tokena
    # --------------------------------------------------
    cancel_token = secrets.token_urlsafe(32)

    # --------------------------------------------------
    # Kreiranje bookinga (atomski sa proverama iznad)
    # --------------------------------------------------
    booking = Booking(
        subject_id=payload.subject_id,
        teacher_id=payload.teacher_id,
        client_full_name=payload.client_full_name,
        client_email=str(payload.client_email).lower(),
        client_category=payload.client_category,
        client_note=payload.client_note,
        delivery_mode=payload.delivery_mode,
        session_type=payload.session_type,
        start_time=payload.start_time,
        end_time=end_time,
        duration_minutes=payload.duration,
        status="confirmed",
        classroom_number=classroom,
        client_cancel_token=cancel_token,
    )
    db.add(booking)
    stored_attachment_names: list[str] = []
    try:
        db.flush()
        for order, (content, orig, ext) in enumerate(prepared_attachments):
            stored = save_booking_attachment(booking.id, content, ext)
            stored_attachment_names.append(stored)
            db.add(
                BookingAttachment(
                    booking_id=booking.id,
                    stored_name=stored,
                    original_name=orig,
                    sort_order=order,
                )
            )
        db.commit()
    except Exception:
        db.rollback()
        for stored_name in stored_attachment_names:
            delete_booking_attachment_file(stored_name)
        raise

    booking_full = (
        db.query(Booking)
        .options(
            joinedload(Booking.attachments),
            joinedload(Booking.subject),
            joinedload(Booking.teacher),
        )
        .filter(Booking.id == booking.id)
        .first()
    )

    logger.info(
        f"Nova rezervacija kreirana: ID={booking_full.id}, "
        f"Klijent={booking_full.client_full_name}, "
        f"Profesor={teacher.full_name}, "
        f"Predmet={subject.name}, "
        f"Termin={booking_full.start_time.strftime('%Y-%m-%d %H:%M')}, "
        f"Učionica={booking_full.classroom_number}"
    )

    # --------------------------------------------------
    # 9. Slanje email obaveštenja (klijent, profesor, admin)
    # --------------------------------------------------
    cancel_url = f"{settings.FRONTEND_URL}/cancel/{cancel_token}"
    email_data = booking_to_email_data(booking_full)
    email_data["subject_name"] = subject.name
    email_data["teacher_name"] = teacher.full_name

    notification_delivery = None
    try:
        notification_delivery = send_booking_confirmation(
            booking_data=email_data,
            client_email=booking_full.client_email,
            teacher_email=teacher.email,
            admin_email=settings.ADMIN_EMAIL,
            cancel_url=cancel_url,
        )
    except Exception:
        logger.exception("Neočekivana greška pri slanju potvrda za rezervaciju ID=%s", booking_full.id)
        notification_delivery = {"sent": 0, "failed": 3, "total": 3, "status": "failed"}

    return BookingResponse(
        id=booking_full.id,
        subject_id=booking_full.subject_id,
        subject_name=subject.name,
        teacher_id=booking_full.teacher_id,
        teacher_name=teacher.full_name,
        client_full_name=booking_full.client_full_name,
        client_email=booking_full.client_email,
        client_category=booking_full.client_category,
        client_note=booking_full.client_note,
        attachments=attachments_from_booking(booking_full),
        delivery_mode=booking_full.delivery_mode,
        session_type=booking_full.session_type,
        start_time=booking_full.start_time,
        end_time=booking_full.end_time,
        duration_minutes=booking_full.duration_minutes,
        status=booking_full.status,
        classroom_number=booking_full.classroom_number,
        cancelled_by=booking_full.cancelled_by,
        cancellation_reason=booking_full.cancellation_reason,
        client_cancel_token=booking_full.client_cancel_token,
        notification_delivery=notification_delivery,
        created_at=booking_full.created_at,
    )


# =============================================
#  Javni — Klijentsko otkazivanje
# =============================================

@router.get("/bookings/cancel/{token}", response_model=BookingCancelPreviewResponse)
def preview_booking_for_cancellation(
    token: str,
    db: Session = Depends(get_db),
):
    """Prikazuje bezbedan rezime časa vlasniku linka za otkazivanje."""
    booking = (
        db.query(Booking)
        .options(joinedload(Booking.subject), joinedload(Booking.teacher))
        .filter(Booking.client_cancel_token == token)
        .first()
    )
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link za otkazivanje nije važeći.",
        )

    start = booking.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    deadline = start - timedelta(hours=24)
    can_cancel = booking.status == "confirmed" and datetime.now(timezone.utc) <= deadline

    return BookingCancelPreviewResponse(
        booking_id=booking.id,
        subject_name=booking.subject.name if booking.subject else "N/A",
        teacher_name=booking.teacher.full_name if booking.teacher else "N/A",
        start_time=booking.start_time,
        end_time=booking.end_time,
        duration_minutes=booking.duration_minutes,
        delivery_mode=booking.delivery_mode,
        session_type=booking.session_type,
        classroom_number=booking.classroom_number,
        status=booking.status,
        can_cancel=can_cancel,
        cancellation_deadline=deadline,
    )


@router.post("/bookings/cancel", response_model=BookingCancelResponse)
def cancel_booking_by_client(
    payload: BookingCancelRequest,
    db: Session = Depends(get_db),
):
    """
    Klijent otkazuje rezervaciju koristeći secure token.
    Javni endpoint — bez autentikacije.

    Pravila:
      - Token mora biti validan
      - Rezervacija mora biti u statusu 'confirmed'
      - Mora biti min 24h pre početka časa
      - Ako je rok istekao: klijent dobija email da se čas mora platiti
    """
    # Pronađi booking po cancel tokenu
    booking = (
        db.query(Booking)
        .filter(Booking.client_cancel_token == payload.token)
        .with_for_update()
        .first()
    )

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nevalidan link za otkazivanje.",
        )

    if booking.status != "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ova rezervacija je već otkazana ili nije aktivna.",
        )

    # Provera roka od 24h
    now = datetime.now(timezone.utc)
    # Osiguraj da je start_time aware
    start = booking.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    time_until_class = start - now
    min_cancel_hours = 24

    if time_until_class < timedelta(hours=min_cancel_hours):
        # Rok je istekao — pošalji email da se čas mora platiti
        email_data = booking_to_email_data(booking)
        notice_sent = False
        try:
            notice_sent = send_late_cancellation_notice(
                client_email=booking.client_email,
                booking_data=email_data,
            )
        except Exception:
            logger.exception("Greška pri slanju obaveštenja o isteklom roku, booking ID=%s", booking.id)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Otkazivanje nije moguće jer je preostalo manje od {min_cancel_hours} sati "
                f"do početka časa. Čas se mora platiti. "
                + ("Obaveštenje je poslato na Vaš email." if notice_sent else "Kontaktirajte BrainStorm centar za dodatne informacije.")
            ),
        )

    # Otkaži booking
    booking.status = "cancelled"
    booking.cancelled_by = "client"
    booking.cancellation_reason = (payload.reason or "").strip() or "Otkazano od strane klijenta"
    db.commit()
    db.refresh(booking)

    logger.info(
        f"Rezervacija otkazana (KLIJENT): ID={booking.id}, "
        f"Klijent={booking.client_full_name}, "
        f"Razlog={booking.cancellation_reason}"
    )

    # Pošalji emailove svima (klijent, profesor, admin)
    email_data = booking_to_email_data(booking)
    notification_delivery = None
    try:
        notification_delivery = send_cancellation_notification(
            booking_data=email_data,
            client_email=booking.client_email,
            teacher_email=booking.teacher.email if booking.teacher else settings.ADMIN_EMAIL,
            admin_email=settings.ADMIN_EMAIL,
            cancelled_by="client",
            reason=booking.cancellation_reason,
        )
    except Exception:
        logger.exception("Neočekivana greška pri slanju otkazivanja za booking ID=%s", booking.id)
        notification_delivery = {"sent": 0, "failed": 3, "total": 3, "status": "failed"}

    return BookingCancelResponse(
        detail="Rezervacija je uspešno otkazana.",
        booking_id=booking.id,
        status=booking.status,
        notification_delivery=notification_delivery,
    )
