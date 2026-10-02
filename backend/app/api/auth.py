from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import verify_password, create_access_token
from app.db.session import get_db
from app.models.admin import Admin
from app.models.teacher import Teacher
from app.schemas.auth import LoginRequest, Token

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/admin/login", response_model=Token)
def admin_login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Admin login — prima email i password, vraca JWT token.
    """
    admin = db.query(Admin).filter(func.lower(Admin.email) == str(payload.email).lower()).first()

    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Pogrešan email ili lozinka.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin nalog je deaktiviran.",
        )

    access_token = create_access_token(
        data={"sub": str(admin.id), "role": "admin", "email": admin.email}
    )

    return Token(access_token=access_token)


@router.post("/teacher/login", response_model=Token)
def teacher_login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Profesor login — prima email i password, vraca JWT token.
    Profesor mora biti aktivan i odobren od strane admina.
    """
    teacher = db.query(Teacher).filter(func.lower(Teacher.email) == str(payload.email).lower()).first()

    if not teacher or not verify_password(payload.password, teacher.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Pogrešan email ili lozinka.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not teacher.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Profesorski nalog je deaktiviran.",
        )

    if not teacher.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vaš nalog još nije odobren od strane admina. Kontaktirajte administraciju.",
        )

    access_token = create_access_token(
        data={"sub": str(teacher.id), "role": "teacher", "email": teacher.email}
    )

    return Token(access_token=access_token)
