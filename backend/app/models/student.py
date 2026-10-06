from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Student(Base):
    """Učenički nalog: samostalna registracija, pregled i otkazivanje sopstvenih časova."""

    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    category = Column(String(50), nullable=True)  # osnovna, srednja, faks, drugo
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    bookings = relationship("Booking", back_populates="student", lazy="selectin")
