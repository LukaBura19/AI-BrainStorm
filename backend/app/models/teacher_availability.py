from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class TeacherAvailability(Base):
    __tablename__ = "teacher_availabilities"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False, index=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Check constraint — end mora biti posle start
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="ck_availability_end_after_start"),
    )

    # Relationships
    teacher = relationship("Teacher", back_populates="availabilities")
