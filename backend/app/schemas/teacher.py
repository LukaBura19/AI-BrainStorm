from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# --------------- Request schemas ---------------

class TeacherCreate(BaseModel):
    """Schema za kreiranje profesora od strane admina."""
    full_name: str = Field(..., min_length=2, max_length=255, examples=["Petar Petrović"])
    email: EmailStr = Field(..., examples=["petar@brainstorm.com"])
    password: str = Field(..., min_length=6, max_length=128)
    is_approved: bool = Field(default=False, description="Da li je profesor odmah odobren")
    subject_ids: list[int] = Field(
        default_factory=list,
        description="Predmeti koje profesor drži",
    )

    @field_validator("full_name", mode="before")
    @classmethod
    def normalize_full_name(cls, value):
        return value if value is None else " ".join(str(value).split())

    @field_validator("password")
    @classmethod
    def validate_bcrypt_password_size(cls, value: str):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Lozinka može imati najviše 72 bajta.")
        return value


class TeacherUpdate(BaseModel):
    """Schema za izmenu profesora. Sva polja su opcionalna."""
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    is_approved: Optional[bool] = None

    @field_validator("full_name", mode="before")
    @classmethod
    def normalize_full_name(cls, value):
        return None if value is None else " ".join(str(value).split())


class TeacherSubjectsAssign(BaseModel):
    """Schema za dodelu predmeta profesoru."""
    subject_ids: list[int] = Field(..., description="Lista ID-jeva predmeta za dodelu")

    @field_validator("subject_ids")
    @classmethod
    def validate_subject_ids(cls, value: list[int]):
        if any(subject_id <= 0 for subject_id in value):
            raise ValueError("ID predmeta mora biti pozitivan broj.")
        return value


# --------------- Response schemas ---------------

class SubjectBrief(BaseModel):
    """Kratki prikaz predmeta (za ugnježdavanje u teacher response)."""
    id: int
    name: str

    model_config = {"from_attributes": True}


class TeacherResponse(BaseModel):
    """Schema za prikaz profesora (admin pogled)."""
    id: int
    full_name: str
    email: str
    is_active: bool
    is_approved: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TeacherWithSubjectsResponse(BaseModel):
    """Schema za prikaz profesora sa listom predmeta."""
    id: int
    full_name: str
    email: str
    is_active: bool
    is_approved: bool
    subjects: list[SubjectBrief] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}


class TeacherListResponse(BaseModel):
    """Schema za listu profesora sa ukupnim brojem."""
    items: list[TeacherResponse]
    total: int


class TeacherWithSubjectsListResponse(BaseModel):
    """Schema za listu profesora sa predmetima."""
    items: list[TeacherWithSubjectsResponse]
    total: int


# --------------- Public response ---------------

class TeacherPublicResponse(BaseModel):
    """Schema za javni prikaz profesora (bez email, statusa)."""
    id: int
    full_name: str
    subjects: list[SubjectBrief] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class TeacherPublicListResponse(BaseModel):
    """Schema za javnu listu profesora."""
    items: list[TeacherPublicResponse]
    total: int
