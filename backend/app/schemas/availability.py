from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.utils.datetime_utils import normalize_to_utc


# --------------- Request schemas ---------------

class AvailabilityCreate(BaseModel):
    """Schema za kreiranje raspoloživosti profesora."""
    start_time: datetime = Field(..., examples=["2026-03-20T09:00:00"])
    end_time: datetime = Field(..., examples=["2026-03-20T14:00:00"])

    @model_validator(mode="after")
    def validate_times(self):
        self.start_time = normalize_to_utc(self.start_time)
        self.end_time = normalize_to_utc(self.end_time)
        if self.end_time <= self.start_time:
            raise ValueError("Završno vreme mora biti posle početnog vremena.")
        # Minimalno trajanje: 45 minuta
        diff_minutes = (self.end_time - self.start_time).total_seconds() / 60
        if diff_minutes < 45:
            raise ValueError("Raspoloživost mora trajati najmanje 45 minuta.")
        return self


# --------------- Response schemas ---------------

class AvailabilityResponse(BaseModel):
    """Schema za prikaz raspoloživosti."""
    id: int
    teacher_id: int
    start_time: datetime
    end_time: datetime
    is_available: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AvailabilityListResponse(BaseModel):
    """Schema za listu raspoloživosti sa ukupnim brojem."""
    items: list[AvailabilityResponse]
    total: int
