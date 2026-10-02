from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="RESTRICT"), nullable=False, index=True)

    # Podaci o klijentu
    client_full_name = Column(String(255), nullable=False)
    client_email = Column(String(255), nullable=False)
    client_category = Column(String(50), nullable=False)  # faks, osnovna, srednja, drugo
    client_note = Column(String(1000), nullable=True)

    # Termin
    start_time = Column(DateTime(timezone=True), nullable=False, index=True)
    end_time = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, nullable=False)  # 45, 60, 90

    # Način održavanja i tip časa (javni booking)
    delivery_mode = Column(String(20), nullable=False, default="in_person")  # online, in_person
    session_type = Column(String(20), nullable=False, default="individual")  # individual, group

    # Status i ucionica (0 = online, bez fizičke učionice)
    status = Column(String(20), nullable=False, default="confirmed")  # confirmed, cancelled
    classroom_number = Column(Integer, nullable=False)  # 0 online, 1 ili 2 uživo

    # Otkazivanje
    cancelled_by = Column(String(20), nullable=True)  # client, teacher, admin
    cancellation_reason = Column(String(500), nullable=True)

    # Bezbedni token za klijentsko otkazivanje
    client_cancel_token = Column(String(255), nullable=False, unique=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Constraints
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="ck_booking_end_after_start"),
        CheckConstraint("duration_minutes IN (45, 60, 90)", name="ck_booking_duration"),
        CheckConstraint(
            "(delivery_mode = 'online' AND classroom_number = 0) OR "
            "(delivery_mode = 'in_person' AND classroom_number IN (1, 2))",
            name="ck_booking_delivery_classroom",
        ),
        CheckConstraint("delivery_mode IN ('online', 'in_person')", name="ck_booking_delivery_mode"),
        CheckConstraint("session_type IN ('individual', 'group')", name="ck_booking_session_type"),
        CheckConstraint("status IN ('confirmed', 'cancelled')", name="ck_booking_status"),
    )

    # Relationships
    subject = relationship("Subject", back_populates="bookings")
    teacher = relationship("Teacher", back_populates="bookings")
    attachments = relationship(
        "BookingAttachment",
        back_populates="booking",
        order_by="BookingAttachment.sort_order",
        cascade="all, delete-orphan",
    )
