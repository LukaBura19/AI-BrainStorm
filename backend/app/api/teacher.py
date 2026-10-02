from datetime import date, datetime, timedelta, timezone
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.deps import get_current_teacher
from app.db.session import get_db
from app.models.booking import Booking
from app.models.booking_attachment import BookingAttachment
from app.models.teacher import Teacher
from app.models.teacher_availability import TeacherAvailability
from app.schemas.auth import TeacherMe, TeacherMeSubject
from app.schemas.availability import (
    AvailabilityCreate,
    AvailabilityListResponse,
    AvailabilityResponse,
)
from app.schemas.booking import (
    BookingCancelResponse,
    BookingListResponse,
    BookingResponse,
    attachments_from_booking,
)
from app.services.attachment_service import resolve_attachment_path
from app.services.email_service import booking_to_email_data, send_cancellation_notification
from app.utils.datetime_utils import local_day_bounds_utc, normalize_to_utc, to_app_timezone

logger = logging.getLogger("brainstorm.teacher")

router = APIRouter(prefix="/teacher", tags=["Teacher"])

AVAILABILITY_ADVISORY_NAMESPACE = 737_002


# =============================================
#  Profesor — Profil
# =============================================

@router.get("/me", response_model=TeacherMe)
def teacher_me(current_teacher: Teacher = Depends(get_current_teacher)):
    """
    Vraca podatke o trenutno ulogovanom profesoru sa predmetima.
    Zastitena ruta — zahteva validan JWT token sa role=teacher.
    Profesor mora biti aktivan i odobren.
    """
    subjects = [
        TeacherMeSubject(id=ts.subject.id, name=ts.subject.name)
        for ts in current_teacher.teacher_subjects
        if ts.subject is not None and ts.subject.is_active
    ]
    return TeacherMe(
        id=current_teacher.id,
        full_name=current_teacher.full_name,
        email=current_teacher.email,
        is_active=current_teacher.is_active,
        is_approved=current_teacher.is_approved,
        subjects=subjects,
    )


# =============================================
#  Profesor — Raspoloživost (Availabilities)
# =============================================

@router.get("/availabilities", response_model=AvailabilityListResponse)
def list_availabilities(
    from_date: Optional[datetime] = Query(None, description="Filtriraj od datuma"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Lista raspoloživosti ulogovanog profesora."""
    query = (
        db.query(TeacherAvailability)
        .filter(
            TeacherAvailability.teacher_id == current_teacher.id,
            TeacherAvailability.is_available == True,  # noqa: E712
        )
    )

    if from_date:
        query = query.filter(TeacherAvailability.end_time >= normalize_to_utc(from_date))

    availabilities = query.order_by(TeacherAvailability.start_time).all()
    return AvailabilityListResponse(items=availabilities, total=len(availabilities))


@router.post(
    "/availabilities",
    response_model=AvailabilityResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_availability(
    payload: AvailabilityCreate,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """
    Kreira novu raspoloživost za ulogovanog profesora.
    Validira da se ne preklapa sa postojećim raspoloživostima.
    """
    if payload.start_time <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nije moguće dodati raspoloživost u prošlosti.",
        )

    # Serijalizuj paralelne izmene raspoloživosti istog profesora.
    db.execute(
        text("SELECT pg_advisory_xact_lock(:namespace, :teacher_id)"),
        {"namespace": AVAILABILITY_ADVISORY_NAMESPACE, "teacher_id": current_teacher.id},
    )

    # Proveri preklapanje sa postojećim raspoloživostima
    overlap = (
        db.query(TeacherAvailability)
        .filter(
            TeacherAvailability.teacher_id == current_teacher.id,
            TeacherAvailability.is_available == True,  # noqa: E712
            TeacherAvailability.start_time < payload.end_time,
            TeacherAvailability.end_time > payload.start_time,
        )
        .first()
    )

    if overlap:
        overlap_start = to_app_timezone(overlap.start_time)
        overlap_end = to_app_timezone(overlap.end_time)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Raspoloživost se preklapa sa postojećom: "
                f"{overlap_start.strftime('%d.%m.%Y %H:%M')} — "
                f"{overlap_end.strftime('%d.%m.%Y %H:%M')}."
            ),
        )

    availability = TeacherAvailability(
        teacher_id=current_teacher.id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_available=True,
    )
    db.add(availability)
    db.commit()
    db.refresh(availability)
    return availability


@router.delete("/availabilities/{availability_id}", status_code=status.HTTP_200_OK)
def delete_availability(
    availability_id: int,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Brisanje (deaktivacija) raspoloživosti. Profesor može obrisati samo svoju."""
    availability = (
        db.query(TeacherAvailability)
        .filter(
            TeacherAvailability.id == availability_id,
            TeacherAvailability.teacher_id == current_teacher.id,
        )
        .first()
    )

    if not availability:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Raspoloživost nije pronađena.",
        )

    # Soft delete — deaktiviramo umesto brisanja
    availability.is_available = False
    db.commit()

    return {"detail": "Raspoloživost je uklonjena."}


# =============================================
#  Profesor — Rezervacije (Bookings)
# =============================================

def _booking_to_response(booking: Booking) -> BookingResponse:
    """Helper — pretvara Booking ORM objekat u BookingResponse za profesora."""
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
        client_cancel_token=None,  # Profesor ne vidi cancel token
        created_at=booking.created_at,
    )


@router.get("/bookings/{booking_id}/attachments/{attachment_id}")
def download_booking_attachment_teacher(
    booking_id: int,
    attachment_id: int,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """Preuzimanje jednog priloga uz rezervaciju (samo vlasnik rezervacije)."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking or booking.teacher_id != current_teacher.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rezervacija nije pronađena.",
        )
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
def list_teacher_bookings(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter: confirmed, cancelled"),
    upcoming_only: bool = Query(False, description="Prikaži samo termine koji još nisu počeli"),
    date_from: Optional[date] = Query(None, description="Od datuma (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="Do datuma (YYYY-MM-DD)"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """
    Lista rezervacija ulogovanog profesora.
    Profesor vidi samo SVOJE rezervacije, sortirane po vremenu.
    """
    query = db.query(Booking).filter(Booking.teacher_id == current_teacher.id)

    if status_filter:
        query = query.filter(Booking.status == status_filter)

    if upcoming_only:
        query = query.filter(Booking.start_time >= datetime.now(timezone.utc))

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


@router.patch("/bookings/{booking_id}/cancel", response_model=BookingCancelResponse)
def cancel_teacher_booking(
    booking_id: int,
    reason: Optional[str] = Query(None, max_length=500, description="Razlog otkazivanja"),
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
):
    """
    Profesor otkazuje svoju rezervaciju.

    Pravila:
      - Rezervacija mora pripadati ulogovanom profesoru
      - Mora biti u statusu 'confirmed'
      - Mora biti minimum 24h pre početka časa
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

    # Profesor može otkazati samo SVOJU rezervaciju
    if booking.teacher_id != current_teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nemate dozvolu da otkažete tuđu rezervaciju.",
        )

    if booking.status != "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ova rezervacija je već otkazana ili nije aktivna.",
        )

    # Provera roka od 24h
    now = datetime.now(timezone.utc)
    start = booking.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    time_until_class = start - now

    if time_until_class < timedelta(hours=24):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Otkazivanje nije moguće jer je preostalo manje od 24 sata "
                "do početka časa. Kontaktirajte admina za pomoć."
            ),
        )

    # Otkaži booking
    booking.status = "cancelled"
    booking.cancelled_by = "teacher"
    booking.cancellation_reason = (reason or "").strip() or "Otkazano od strane profesora"
    db.commit()
    db.refresh(booking)

    logger.info(
        f"Rezervacija otkazana (PROFESOR): ID={booking.id}, "
        f"Profesor={current_teacher.full_name}, "
        f"Klijent={booking.client_full_name}, "
        f"Razlog={booking.cancellation_reason}"
    )

    # Pošalji emailove (klijent, profesor, admin)
    email_data = booking_to_email_data(booking)
    notification_delivery = None
    try:
        notification_delivery = send_cancellation_notification(
            booking_data=email_data,
            client_email=booking.client_email,
            teacher_email=current_teacher.email,
            admin_email=settings.ADMIN_EMAIL,
            cancelled_by="teacher",
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
