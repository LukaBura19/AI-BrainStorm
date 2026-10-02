from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# --------------- Request schemas ---------------

class SubjectCreate(BaseModel):
    """Schema za kreiranje novog predmeta."""
    name: str = Field(..., min_length=1, max_length=255, examples=["Matematika"])

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value):
        return value if value is None else " ".join(str(value).split())


class SubjectUpdate(BaseModel):
    """Schema za izmenu predmeta. Sva polja su opcionalna."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_active: Optional[bool] = None

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value):
        return None if value is None else " ".join(str(value).split())


# --------------- Response schemas ---------------

class SubjectResponse(BaseModel):
    """Schema za prikaz predmeta."""
    id: int
    name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SubjectListResponse(BaseModel):
    """Schema za listu predmeta sa ukupnim brojem."""
    items: list[SubjectResponse]
    total: int
