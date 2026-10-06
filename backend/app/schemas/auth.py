from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# --------------- Request schemas ---------------

class LoginRequest(BaseModel):
    """Schema za login request (admin i profesor)."""
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class StudentRegisterRequest(BaseModel):
    """Samostalna registracija učenika."""
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    category: Optional[Literal["osnovna", "srednja", "faks", "drugo"]] = None

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Ime i prezime mora imati najmanje 2 karaktera.")
        return value


# --------------- Response schemas ---------------

class Token(BaseModel):
    """Schema za JWT token response."""
    access_token: str
    token_type: str = "bearer"


class AdminMe(BaseModel):
    """Schema za GET /admin/me response."""
    id: int
    full_name: str
    email: str
    is_active: bool

    model_config = {"from_attributes": True}


class TeacherMeSubject(BaseModel):
    """Kratki prikaz predmeta u teacher/me response."""
    id: int
    name: str

    model_config = {"from_attributes": True}


class TeacherMe(BaseModel):
    """Schema za GET /teacher/me response — uključuje predmete."""
    id: int
    full_name: str
    email: str
    is_active: bool
    is_approved: bool
    subjects: list[TeacherMeSubject] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class StudentMe(BaseModel):
    """Schema za GET /student/me response."""
    id: int
    full_name: str
    email: str
    category: Optional[str] = None

    model_config = {"from_attributes": True}
