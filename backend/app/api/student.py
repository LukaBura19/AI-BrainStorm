from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_student
from app.db.session import get_db
from app.models.booking import Booking
from app.models.student import Student
from app.schemas.auth import StudentMe
from app.schemas.booking import BookingListResponse, BookingResponse, attachments_from_booking

router = APIRouter(prefix="/student", tags=["Student"])


@router.get("/me", response_model=StudentMe)
def student_me(current_student: Student = Depends(get_current_student)):
    """Profil prijavljenog učenika."""
    return current_student


def _booking_to_response(booking: Booking) -> BookingResponse:
    """Učenik vidi sopstveni čas, uključujući token za otkazivanje (čas je vezan za njegov nalog)."""
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
        client_cancel_token=booking.client_cancel_token,
        created_at=booking.created_at,
    )


@router.get("/bookings", response_model=BookingListResponse)
def list_student_bookings(
    upcoming_only: bool = Query(False, description="Samo potvrđeni časovi koji još nisu počeli"),
    current_student: Student = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """
    Časovi prijavljenog učenika. Vezuju se preko naloga (student_id), ne preko email adrese,
    pa niko ne može da vidi tuđe časove registracijom na tuđu adresu.
    """
    query = db.query(Booking).filter(Booking.student_id == current_student.id)
    if upcoming_only:
        query = query.filter(Booking.status == "confirmed", Booking.start_time >= datetime.now(timezone.utc))
    order = Booking.start_time.asc() if upcoming_only else Booking.start_time.desc()
    bookings = query.options(joinedload(Booking.attachments)).order_by(order).all()
    items = [_booking_to_response(b) for b in bookings]
    return BookingListResponse(items=items, total=len(items))
