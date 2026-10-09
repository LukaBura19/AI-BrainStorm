from datetime import date, datetime, timedelta, timezone
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.deps import get_current_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models.admin import Admin
from app.models.booking import Booking
from app.models.booking_attachment import BookingAttachment
from app.models.student import Student
from app.models.subject import Subject
from app.models.teacher import Teacher
from app.models.teacher_availability import TeacherAvailability
from app.models.teacher_subject import TeacherSubject
from app.schemas.auth import AdminMe, StudentAdminListResponse, StudentAdminResponse, StudentAdminUpdate
from app.schemas.booking import (
    BookingCancelResponse,
    BookingListResponse,
    BookingReassign,
    BookingResponse,
    NotificationDelivery,
    attachments_from_booking,
)
from app.schemas.classroom import ClassroomDaySchedule, ClassroomScheduleResponse, ClassroomSlot
from app.schemas.subject import (
    SubjectCreate,
    SubjectListResponse,
    SubjectResponse,
    SubjectUpdate,
)
from app.schemas.teacher import (
    SubjectBrief,
    TeacherCreate,
    TeacherListResponse,
    TeacherResponse,
    TeacherSubjectsAssign,
    TeacherUpdate,
    TeacherWithSubjectsResponse,
    TeacherWithSubjectsListResponse,
)
from app.services.attachment_service import resolve_attachment_path
from app.services.classroom_service import assign_classroom
from app.services.email_service import (
    booking_to_email_data,
    send_booking_change_notification,
    send_cancellation_notification,
)
from app.utils.datetime_utils import local_day_bounds_utc, to_app_timezone

logger = logging.getLogger("brainstorm.admin")

CLASSROOM_LABELS = {1: "Učionica 1 (velika)", 2: "Učionica 2 (mala)"}

# Konstanta za advisory lock (booking operacije)
BOOKING_ADVISORY_LOCK_ID = 737_001

router = APIRouter(prefix="/admin", tags=["Admin"])


# =============================================
#  Admin — Profil
# =============================================

@router.get("/me", response_model=AdminMe)
def admin_me(current_admin: Admin = Depends(get_current_admin)):
    """
    Vraca podatke o trenutno ulogovanom adminu.
    Zastitena ruta — zahteva validan JWT token sa role=admin.
    """
    return current_admin


# =============================================
#  Admin — Predmeti (Subjects CRUD)
# =============================================

@router.get("/subjects", response_model=SubjectListResponse)
def list_subjects(
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """Lista svih predmeta (uključujući neaktivne). Samo za admina."""
    subjects = db.query(Subject).order_by(Subject.name).all()
    return SubjectListResponse(items=subjects, total=len(subjects))


@router.post("/subjects", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """Kreira novi predmet. Samo za admina."""
    existing = db.query(Subject).filter(func.lower(Subject.name) == payload.name.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Predmet '{payload.name}' već postoji.",
        )

    subject = Subject(name=payload.name, is_active=True)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.get("/subjects/{subject_id}", response_model=SubjectResponse)
def get_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """Dohvata pojedinačni predmet po ID-u. Samo za admina."""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Predmet nije pronađen.",
        )
    return subject


@router.patch("/subjects/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """Izmena predmeta (ime i/ili aktivan status). Samo za admina."""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Predmet nije pronađen.",
        )

    if payload.name is not None:
        # Proveri da li ime već postoji (osim ovog predmeta)
        duplicate = (
            db.query(Subject)
            .filter(func.lower(Subject.name) == payload.name.lower(), Subject.id != subject_id)
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Predmet '{payload.name}' već postoji.",
            )
        subject.name = payload.name

    if payload.is_active is not None:
        subject.is_active = payload.is_active

    db.commit()
    db.refresh(subject)
    return subject


# =============================================
#  Admin — Profesori (Teachers CRUD)
# =============================================

@router.get("/teachers", response_model=TeacherWithSubjectsListResponse)
def list_teachers(
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """Lista svih profesora (uključujući neaktivne i neodobrene). Samo za admina."""
    teachers = db.query(Teacher).order_by(Teacher.full_name).all()
    items = [_teacher_with_subjects(teacher) for teacher in teachers]
    return TeacherWithSubjectsListResponse(items=items, total=len(items))


@router.post("/teachers", response_model=TeacherWithSubjectsResponse, status_code=status.HTTP_201_CREATED)
def create_teacher(
    payload: TeacherCreate,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """Kreira novog profesora. Samo za admina."""
    existing = db.query(Teacher).filter(func.lower(Teacher.email) == str(payload.email).lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Profesor sa emailom '{payload.email}' već postoji.",
        )

    subject_ids = list(dict.fromkeys(payload.subject_ids))
    subjects = []
    if subject_ids:
        subjects = db.query(Subject).filter(Subject.id.in_(subject_ids)).all()
        found_ids = {subject.id for subject in subjects}
        missing_ids = set(subject_ids) - found_ids
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Predmeti sa ID-jevima {sorted(missing_ids)} nisu pronađeni.",
            )
        inactive_names = sorted(subject.name for subject in subjects if not subject.is_active)
        if inactive_names:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Neaktivni predmeti se ne mogu dodeliti: {', '.join(inactive_names)}.",
            )

    teacher = Teacher(
        full_name=payload.full_name,
        email=str(payload.email).lower(),
        password_hash=hash_password(payload.password),
        is_active=True,
        is_approved=payload.is_approved,
    )
    db.add(teacher)
    db.flush()
    for subject in subjects:
        db.add(TeacherSubject(teacher_id=teacher.id, subject_id=subject.id))
    db.commit()
    db.refresh(teacher)
    return _teacher_with_subjects(teacher)


@router.get("/teachers/{teacher_id}", response_model=TeacherResponse)
def get_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """Dohvata pojedinačnog profesora po ID-u. Samo za admina."""
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor nije pronađen.",
        )
    return teacher


@router.patch("/teachers/{teacher_id}", response_model=TeacherResponse)
def update_teacher(
    teacher_id: int,
    payload: TeacherUpdate,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """Izmena profesora (ime, email, aktivan, odobren). Samo za admina."""
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor nije pronađen.",
        )

    if payload.full_name is not None:
        teacher.full_name = payload.full_name

    if payload.email is not None:
        # Proveri da li email već postoji (osim ovog profesora)
        duplicate = (
            db.query(Teacher)
            .filter(func.lower(Teacher.email) == str(payload.email).lower(), Teacher.id != teacher_id)
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{payload.email}' već koristi drugi profesor.",
            )
        teacher.email = str(payload.email).lower()

    if payload.is_active is not None:
        teacher.is_active = payload.is_active

    if payload.is_approved is not None:
        teacher.is_approved = payload.is_approved

    db.commit()
    db.refresh(teacher)
    return teacher


@router.patch("/teachers/{teacher_id}/approve", response_model=TeacherResponse)
def approve_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """Odobrava profesora (is_approved = true). Samo za admina."""
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor nije pronađen.",
        )

    if teacher.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profesor je već odobren.",
        )

    teacher.is_approved = True
    db.commit()
    db.refresh(teacher)
    return teacher


# =============================================
#  Admin — Profesor-Predmet veza (TeacherSubjects)
# =============================================

def _teacher_with_subjects(teacher: Teacher) -> dict:
    """Helper — pretvara Teacher + relationships u dict sa subjects listom."""
    return {
        "id": teacher.id,
        "full_name": teacher.full_name,
        "email": teacher.email,
        "is_active": teacher.is_active,
        "is_approved": teacher.is_approved,
        "created_at": teacher.created_at,
        "subjects": [
            SubjectBrief(id=ts.subject.id, name=ts.subject.name)
            for ts in teacher.teacher_subjects
            if ts.subject is not None
        ],
    }


@router.get("/teachers/{teacher_id}/subjects", response_model=TeacherWithSubjectsResponse)
def get_teacher_subjects(
    teacher_id: int,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """Dohvata profesora sa listom dodeljenih predmeta. Samo za admina."""
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor nije pronađen.",
        )
    return _teacher_with_subjects(teacher)


@router.post(
    "/teachers/{teacher_id}/subjects",
    response_model=TeacherWithSubjectsResponse,
    status_code=status.HTTP_200_OK,
)
def assign_subjects_to_teacher(
    teacher_id: int,
    payload: TeacherSubjectsAssign,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """
    Dodeljuje predmete profesoru (zamenjuje postojeće dodele).
    Prosledi listu subject_ids — sistem će obrisati stare i dodati nove.
    """
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor nije pronađen.",
        )

    # Validacija da svi subject_ids postoje i da su aktivni
    subjects = (
        db.query(Subject)
        .filter(Subject.id.in_(payload.subject_ids))
        .all()
    )
    found_ids = {s.id for s in subjects}
    missing_ids = set(payload.subject_ids) - found_ids
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Predmeti sa ID-jevima {sorted(missing_ids)} nisu pronađeni.",
        )
    inactive_names = sorted(s.name for s in subjects if not s.is_active)
    if inactive_names:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Neaktivni predmeti se ne mogu dodeliti: {', '.join(inactive_names)}.",
        )

    # Obriši postojeće dodele
    db.query(TeacherSubject).filter(TeacherSubject.teacher_id == teacher_id).delete()

    # Dodaj nove
    for subject_id in dict.fromkeys(payload.subject_ids):
        db.add(TeacherSubject(teacher_id=teacher_id, subject_id=subject_id))

    db.commit()
    db.refresh(teacher)
    return _teacher_with_subjects(teacher)


@router.delete(
    "/teachers/{teacher_id}/subjects/{subject_id}",
    response_model=TeacherWithSubjectsResponse,
)
def remove_subject_from_teacher(
    teacher_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """Uklanja jedan predmet od profesora. Samo za admina."""
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor nije pronađen.",
        )

    link = (
        db.query(TeacherSubject)
        .filter(
            TeacherSubject.teacher_id == teacher_id,
            TeacherSubject.subject_id == subject_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profesor nema dodeljen taj predmet.",
        )

    db.delete(link)
    db.commit()
    db.refresh(teacher)
    return _teacher_with_subjects(teacher)


# =============================================
#  Admin — Rezervacije (Bookings)
# =============================================

def _booking_to_response(booking: Booking) -> BookingResponse:
    """Helper — pretvara Booking ORM objekat u BookingResponse."""
    return BookingResponse(
        id=booking.id,
        subject_id=booking.subject_id,
        subject_name=booking.subject.name if booking.subject else "N/A",
        teacher_id=booking.teacher_id,
        teacher_name=booking.teacher.full_name if booking.teacher else "N/A",
        client_full_name=booking.client_full_name,
        client_email=booking.client_email,
        client_category=booking.client_category,
        client_note=booking.client_note,
        attachments=attachments_from_booking(booking),
        delivery_mode=booking.delivery_mode,
        session_type=booking.session_type,
        start_time=booking.start_time,
        end_time=booking.end_time,
        duration_minutes=booking.duration_minutes,
        status=booking.status,
        classroom_number=booking.classroom_number,
        cancelled_by=booking.cancelled_by,
        cancellation_reason=booking.cancellation_reason,
        client_cancel_token=None,  # Admin ne vidi cancel token
        created_at=booking.created_at,
    )


@router.get("/bookings/{booking_id}/attachments/{attachment_id}")
def download_booking_attachment_admin(
    booking_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """Preuzimanje jednog priloga uz rezervaciju (samo admin)."""
    att = (
        db.query(BookingAttachment)
        .filter(
            BookingAttachment.id == attachment_id,
            BookingAttachment.booking_id == booking_id,
        )
        .first()
    )
    if not att:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prilog nije pronađen.",
        )
    path = resolve_attachment_path(att.stored_name)
    return FileResponse(path, filename=att.original_name, media_type="application/octet-stream")


@router.get("/bookings", response_model=BookingListResponse)
def list_bookings(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter po statusu: confirmed, cancelled"),
    upcoming_only: bool = Query(False, description="Prikaži samo termine koji još nisu počeli"),
    teacher_id: Optional[int] = Query(None, description="Filter po ID-u profesora"),
    subject_id: Optional[int] = Query(None, description="Filter po ID-u predmeta"),
    classroom: Optional[int] = Query(None, description="Filter po broju učionice: 1 ili 2"),
    date_from: Optional[date] = Query(None, description="Od datuma (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="Do datuma (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """
    Lista svih rezervacija sa opcionalnim filterima.
    Samo za admina.
    """
    query = db.query(Booking)

    # Filteri
    if status_filter:
        query = query.filter(Booking.status == status_filter)

    if upcoming_only:
        query = query.filter(Booking.start_time >= datetime.now(timezone.utc))

    if teacher_id is not None:
        query = query.filter(Booking.teacher_id == teacher_id)

    if subject_id is not None:
        query = query.filter(Booking.subject_id == subject_id)

    if classroom is not None:
        query = query.filter(Booking.classroom_number == classroom)

    if date_from is not None:
        day_start, _ = local_day_bounds_utc(date_from)
        query = query.filter(Booking.start_time >= day_start)

    if date_to is not None:
        _, day_end = local_day_bounds_utc(date_to)
        query = query.filter(Booking.start_time < day_end)

    order = Booking.start_time.asc() if upcoming_only else Booking.start_time.desc()
    bookings = query.options(joinedload(Booking.attachments)).order_by(order).all()

    items = [_booking_to_response(b) for b in bookings]
    return BookingListResponse(items=items, total=len(items))


@router.get("/bookings/{booking_id}", response_model=BookingResponse)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """Dohvata pojedinačnu rezervaciju po ID-u. Samo za admina."""
    booking = (
        db.query(Booking)
        .options(joinedload(Booking.attachments))
        .filter(Booking.id == booking_id)
        .first()
    )
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rezervacija nije pronađena.",
        )
    return _booking_to_response(booking)


@router.patch("/bookings/{booking_id}/reassign", response_model=BookingResponse)
def reassign_booking(
    booking_id: int,
    payload: BookingReassign,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """
    Prebacuje rezervaciju drugom profesoru i/ili menja termin.
    Ponovo proverava sva pravila dostupnosti i kapaciteta.
    Samo za admina.
    """
    # Isti redosled zaključavanja kao kod javnog kreiranja sprečava da se
    # paralelni create/reassign zahtevi međusobno mimoiđu ili blokiraju ukrug.
    db.execute(
        text("SELECT pg_advisory_xact_lock(:lock_id)"),
        {"lock_id": BOOKING_ADVISORY_LOCK_ID},
    )
    booking = (
        db.query(Booking)
        .filter(Booking.id == booking_id)
        .with_for_update()
        .first()
    )
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rezervacija nije pronađena.",
        )

    if booking.status != "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Samo potvrđene rezervacije se mogu prebaciti.",
        )

    previous_teacher_email = booking.teacher.email if booking.teacher else None

    # Odredi nove vrednosti (koristi postojeće ako nije prosleđeno)
    new_teacher_id = payload.teacher_id if payload.teacher_id is not None else booking.teacher_id
    new_subject_id = payload.subject_id if payload.subject_id is not None else booking.subject_id
    new_start_time = payload.start_time if payload.start_time is not None else booking.start_time
    new_duration = payload.duration if payload.duration is not None else booking.duration_minutes
    new_end_time = new_start_time + timedelta(minutes=new_duration)

    if new_start_time <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rezervacija se ne može prebaciti u termin koji je prošao.",
        )

    # --------------------------------------------------
    # 1. Profesor postoji, aktivan je i odobren
    # --------------------------------------------------
    teacher = db.query(Teacher).filter(Teacher.id == new_teacher_id).first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Novi profesor nije pronađen.",
        )
    if not teacher.is_active or not teacher.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Novi profesor nije aktivan ili odobren.",
        )

    # --------------------------------------------------
    # 2. Predmet postoji i aktivan je
    # --------------------------------------------------
    subject = db.query(Subject).filter(Subject.id == new_subject_id).first()
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
    # 3. Profesor predaje predmet
    # --------------------------------------------------
    teaches = (
        db.query(TeacherSubject)
        .filter(
            TeacherSubject.teacher_id == new_teacher_id,
            TeacherSubject.subject_id == new_subject_id,
        )
        .first()
    )
    if not teaches:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Novi profesor ne predaje izabrani predmet.",
        )

    # --------------------------------------------------
    # 4. Termin unutar raspoloživosti novog profesora
    # --------------------------------------------------
    availability_match = (
        db.query(TeacherAvailability)
        .filter(
            TeacherAvailability.teacher_id == new_teacher_id,
            TeacherAvailability.is_available == True,  # noqa: E712
            TeacherAvailability.start_time <= new_start_time,
            TeacherAvailability.end_time >= new_end_time,
        )
        .first()
    )
    if not availability_match:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Traženi termin nije unutar raspoloživosti novog profesora.",
        )

    # --------------------------------------------------
    # 5. Nema preklapanja sa bookingima novog profesora
    #    (isključujemo trenutni booking)
    # --------------------------------------------------
    teacher_conflict = (
        db.query(Booking)
        .filter(
            Booking.teacher_id == new_teacher_id,
            Booking.status == "confirmed",
            Booking.start_time < new_end_time,
            Booking.end_time > new_start_time,
            Booking.id != booking_id,
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
                f"Novi profesor već ima čas u periodu "
                f"{conflict_start.strftime('%H:%M')}—"
                f"{conflict_end.strftime('%H:%M')}."
            ),
        )

    # --------------------------------------------------
    # 6. Dodela učionice (isključi trenutni booking)
    # --------------------------------------------------
    classroom = assign_classroom(
        db,
        new_start_time,
        new_end_time,
        exclude_booking_id=booking_id,
        lock_rows=True,
        delivery_mode=booking.delivery_mode,
    )
    if classroom is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Obe učionice su zauzete u novom terminu.",
        )

    # --------------------------------------------------
    # Ažuriraj booking
    # --------------------------------------------------
    booking.teacher_id = new_teacher_id
    booking.subject_id = new_subject_id
    booking.start_time = new_start_time
    booking.end_time = new_end_time
    booking.duration_minutes = new_duration
    booking.classroom_number = classroom

    db.commit()
    db.refresh(booking)

    logger.info(
        f"Rezervacija preraspoređena (ADMIN): ID={booking.id}, "
        f"NoviProfesor={teacher.full_name}, "
        f"NoviTermin={booking.start_time.strftime('%Y-%m-%d %H:%M')}, "
        f"NovaUčionica={booking.classroom_number}"
    )

    # Klijent, (novi) profesor i admin saznaju za novi termin; prethodni profesor da čas više nije njegov.
    notification_delivery = None
    try:
        notification_delivery = send_booking_change_notification(
            booking_data=booking_to_email_data(booking),
            client_email=booking.client_email,
            teacher_email=teacher.email,
            admin_email=settings.ADMIN_EMAIL,
            previous_teacher_email=previous_teacher_email,
            cancel_url=f"{settings.FRONTEND_URL}/cancel/{booking.client_cancel_token}",
        )
    except Exception:
        logger.exception("Neočekivana greška pri slanju obaveštenja o izmeni za booking ID=%s", booking.id)
        notification_delivery = {"sent": 0, "failed": 3, "total": 3, "status": "failed"}

    response = _booking_to_response(booking)
    response.notification_delivery = NotificationDelivery(**notification_delivery)
    return response


@router.patch("/bookings/{booking_id}/cancel", response_model=BookingCancelResponse)
def cancel_booking_by_admin(
    booking_id: int,
    reason: Optional[str] = Query(None, max_length=500, description="Razlog otkazivanja"),
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """
    Admin otkazuje bilo koju rezervaciju — BEZ ograničenja od 24h.
    Šalje email obaveštenje klijentu, profesoru i adminu.
    Samo za admina.
    """
    booking = (
        db.query(Booking)
        .filter(Booking.id == booking_id)
        .with_for_update()
        .first()
    )

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rezervacija nije pronađena.",
        )

    if booking.status != "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ova rezervacija je već otkazana ili nije aktivna.",
        )

    # Otkaži booking — admin nema 24h ograničenje
    booking.status = "cancelled"
    booking.cancelled_by = "admin"
    booking.cancellation_reason = (reason or "").strip() or "Otkazano od strane admina"
    db.commit()
    db.refresh(booking)

    logger.info(
        f"Rezervacija otkazana (ADMIN): ID={booking.id}, "
        f"Klijent={booking.client_full_name}, "
        f"Razlog={booking.cancellation_reason}"
    )

    # Pošalji emailove (klijent, profesor, admin)
    email_data = booking_to_email_data(booking)
    teacher_email = booking.teacher.email if booking.teacher else settings.ADMIN_EMAIL
    notification_delivery = None
    try:
        notification_delivery = send_cancellation_notification(
            booking_data=email_data,
            client_email=booking.client_email,
            teacher_email=teacher_email,
            admin_email=settings.ADMIN_EMAIL,
            cancelled_by="admin",
            reason=booking.cancellation_reason,
        )
    except Exception:
        logger.exception("Neočekivana greška pri slanju otkazivanja za booking ID=%s", booking.id)
        notification_delivery = {"sent": 0, "failed": 3, "total": 3, "status": "failed"}

    return BookingCancelResponse(
        detail="Rezervacija je uspešno otkazana od strane admina.",
        booking_id=booking.id,
        status=booking.status,
        notification_delivery=notification_delivery,
    )


# =============================================
#  Admin — Učenički nalozi
# =============================================

def _student_to_admin_response(student: Student, now: datetime) -> StudentAdminResponse:
    bookings = student.bookings or []
    return StudentAdminResponse(
        id=student.id,
        full_name=student.full_name,
        email=student.email,
        category=student.category,
        is_active=student.is_active,
        created_at=student.created_at,
        bookings_total=len(bookings),
        bookings_upcoming=sum(
            1 for b in bookings
            if b.status == "confirmed" and normalize_aware(b.start_time) >= now
        ),
    )


def normalize_aware(value: datetime) -> datetime:
    """SQLite/stari redovi mogu vratiti naivno vreme; tretiramo ga kao UTC."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


@router.get("/students", response_model=StudentAdminListResponse)
def list_students(
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """
    Svi učenički nalozi, najnoviji prvi, sa brojem časova zakazanih dok je učenik bio prijavljen.
    Samo za admina.
    """
    now = datetime.now(timezone.utc)
    students = db.query(Student).order_by(Student.created_at.desc(), Student.id.desc()).all()
    items = [_student_to_admin_response(student, now) for student in students]
    return StudentAdminListResponse(items=items, total=len(items))


@router.patch("/students/{student_id}", response_model=StudentAdminResponse)
def update_student(
    student_id: int,
    payload: StudentAdminUpdate,
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """Aktivira ili deaktivira učenički nalog (deaktiviran nalog ne može da se prijavi). Samo za admina."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Učenik nije pronađen.",
        )
    student.is_active = payload.is_active
    db.commit()
    db.refresh(student)
    return _student_to_admin_response(student, datetime.now(timezone.utc))


# =============================================
#  Admin — Pregled zauzeća učionica
# =============================================

@router.get("/classrooms/schedule", response_model=ClassroomScheduleResponse)
def get_classroom_schedule(
    target_date: date = Query(..., alias="date", description="Datum (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    _current_admin: Admin = Depends(get_current_admin),
):
    """
    Prikazuje raspored obe učionice za odabrani dan.
    Vraća sve potvrđene rezervacije grupisane po učionici,
    sa ukupnim brojem termina i minuta zauzeća.
    Samo za admina.
    """
    day_start, day_end = local_day_bounds_utc(target_date)

    # Dohvati sve potvrđene bookinge za taj dan
    bookings = (
        db.query(Booking)
        .filter(
            Booking.status == "confirmed",
            Booking.classroom_number.in_((1, 2)),
            Booking.start_time >= day_start,
            Booking.start_time < day_end,
        )
        .order_by(Booking.start_time)
        .all()
    )

    # Grupiši po učionici
    classrooms_data: dict[int, list[ClassroomSlot]] = {1: [], 2: []}
    for b in bookings:
        slot = ClassroomSlot(
            booking_id=b.id,
            subject_name=b.subject.name if b.subject else "N/A",
            teacher_name=b.teacher.full_name if b.teacher else "N/A",
            client_full_name=b.client_full_name,
            start_time=b.start_time,
            end_time=b.end_time,
            duration_minutes=b.duration_minutes,
            status=b.status,
        )
        cn = b.classroom_number
        if cn in classrooms_data:
            classrooms_data[cn].append(slot)
        else:
            classrooms_data[cn] = [slot]

    classrooms = []
    for cn in [1, 2]:
        slots = classrooms_data.get(cn, [])
        classrooms.append(
            ClassroomDaySchedule(
                classroom_number=cn,
                classroom_label=CLASSROOM_LABELS.get(cn, f"Učionica {cn}"),
                slots=slots,
                total_slots=len(slots),
                total_minutes=sum(s.duration_minutes for s in slots),
            )
        )

    return ClassroomScheduleResponse(
        date=target_date.isoformat(),
        classrooms=classrooms,
        total_bookings=len(bookings),
    )
