from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ClassroomSlot(BaseModel):
    """Jedan zauzeti termin u učionici."""
    booking_id: int
    subject_name: str
    teacher_name: str
    client_full_name: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    status: str


class ClassroomDaySchedule(BaseModel):
    """Raspored jedne učionice za jedan dan."""
    classroom_number: int
    classroom_label: str
    slots: list[ClassroomSlot]
    total_slots: int
    total_minutes: int


class ClassroomScheduleResponse(BaseModel):
    """Kompletni raspored obe učionice za odabrani dan."""
    date: str
    classrooms: list[ClassroomDaySchedule]
    total_bookings: int
