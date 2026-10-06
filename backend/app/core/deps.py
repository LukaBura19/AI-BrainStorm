from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.admin import Admin
from app.models.student import Student
from app.models.teacher import Teacher

# Swagger UI ce koristiti ove URL-ove za token forme
oauth2_admin_scheme = OAuth2PasswordBearer(tokenUrl="/auth/admin/login")
oauth2_teacher_scheme = OAuth2PasswordBearer(tokenUrl="/auth/teacher/login")
oauth2_student_scheme = OAuth2PasswordBearer(tokenUrl="/auth/student/login")


def get_current_admin(
    token: str = Depends(oauth2_admin_scheme),
    db: Session = Depends(get_db),
) -> Admin:
    """
    Dependency koja dekodira JWT token i vraca Admin objekat.
    Koristi se za zastitu admin ruta.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Nevažeći ili istekli token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: int | None = payload.get("sub")
    role: str | None = payload.get("role")

    if user_id is None or role != "admin":
        raise credentials_exception

    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        raise credentials_exception

    admin = db.query(Admin).filter(Admin.id == user_id_int).first()
    if admin is None or not admin.is_active:
        raise credentials_exception

    return admin


def get_current_teacher(
    token: str = Depends(oauth2_teacher_scheme),
    db: Session = Depends(get_db),
) -> Teacher:
    """
    Dependency koja dekodira JWT token i vraca Teacher objekat.
    Koristi se za zastitu profesorskih ruta.
    Profesor mora biti aktivan i odobren.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Nevažeći ili istekli token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: int | None = payload.get("sub")
    role: str | None = payload.get("role")

    if user_id is None or role != "teacher":
        raise credentials_exception

    try:
        user_id_int = int(user_id)
    except (TypeError, ValueError):
        raise credentials_exception

    teacher = db.query(Teacher).filter(Teacher.id == user_id_int).first()
    if teacher is None or not teacher.is_active:
        raise credentials_exception

    if not teacher.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vaš nalog još nije odobren od strane admina.",
        )

    return teacher


def _student_from_token(token: Optional[str], db: Session) -> Optional[Student]:
    """Vraća aktivnog učenika iz JWT tokena ili None (nevažeći token, druga uloga, deaktiviran nalog)."""
    payload = decode_access_token(token) if token else None
    if not payload or payload.get("role") != "student":
        return None
    try:
        student_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        return None
    student = db.query(Student).filter(Student.id == student_id).first()
    return student if student and student.is_active else None


def get_current_student(
    token: str = Depends(oauth2_student_scheme),
    db: Session = Depends(get_db),
) -> Student:
    """Dependency za zaštićene učeničke rute."""
    student = _student_from_token(token, db)
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nevažeći ili istekli token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return student


def get_optional_student(request: Request, db: Session = Depends(get_db)) -> Optional[Student]:
    """Za javne rute: prijavljeni učenik ako postoji važeći učenički token, inače None (bez greške)."""
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer":
        return None
    return _student_from_token(token.strip(), db)
