from pydantic import BaseModel, EmailStr, Field


# --------------- Request schemas ---------------

class LoginRequest(BaseModel):
    """Schema za login request (admin i profesor)."""
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


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
