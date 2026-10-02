from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.admin import Admin
from app.models.teacher import Teacher

# Swagger UI ce koristiti ove URL-ove za token forme
oauth2_admin_scheme = OAuth2PasswordBearer(tokenUrl="/auth/admin/login")
oauth2_teacher_scheme = OAuth2PasswordBearer(tokenUrl="/auth/teacher/login")


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
