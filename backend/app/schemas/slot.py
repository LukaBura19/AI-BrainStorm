from datetime import datetime

from pydantic import BaseModel


class AvailableSlot(BaseModel):
    """Jedan dostupan termin."""
    start_time: datetime
    end_time: datetime


class AvailableSlotsResponse(BaseModel):
    """Odgovor sa listom dostupnih termina."""
    teacher_id: int
    date: str
    duration: int
    slots: list[AvailableSlot]
    total: int
