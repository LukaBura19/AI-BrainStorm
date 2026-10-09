from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import verify_password, create_access_token
from app.db.session import get_db
from app.core.security import hash_password
from app.models.admin import Admin
from app.models.student import Student
from app.models.teacher import Teacher
from app.schemas.auth import LoginRequest, StudentRegisterRequest, Token

router = APIRouter(prefix="/auth", tags=["Auth"])


def _linked_admin_token(db: Session, email: str, password: str) -> dict[str, str]:
    """Token za admin ulogu ako isti email i lozinka postoje i među adminima."""
    admin = db.query(Admin).filter(func.lower(Admin.email) == email.lower(), Admin.is_active == True).first()  # noqa: E712
    if admin and verify_password(password, admin.password_hash):
        return {"admin": create_access_token(data={"sub": str(admin.id), "role": "admin", "email": admin.email})}
    return {}


def _linked_teacher_token(db: Session, email: str, password: str) -> dict[str, str]:
    """Token za profesorsku ulogu ako isti email i lozinka postoje i među odobrenim profesorima."""
    teacher = (
        db.query(Teacher)
        .filter(func.lower(Teacher.email) == email.lower(), Teacher.is_active == True, Teacher.is_approved == True)  # noqa: E712
        .first()
    )
    if teacher and verify_password(password, teacher.password_hash):
        return {"teacher": create_access_token(data={"sub": str(teacher.id), "role": "teacher", "email": teacher.email})}
    return {}


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

    return Token(access_token=access_token, linked_tokens=_linked_teacher_token(db, admin.email, payload.password))


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

    return Token(access_token=access_token, linked_tokens=_linked_admin_token(db, teacher.email, payload.password))


@router.post("/student/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def student_register(payload: StudentRegisterRequest, db: Session = Depends(get_db)):
    """
    Registracija učenika — kreira nalog i odmah vraća JWT token (prijava posle registracije).
    """
    email = str(payload.email).lower()
    if db.query(Student).filter(func.lower(Student.email) == email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Nalog sa ovom email adresom već postoji. Prijavite se.",
        )
    student = Student(
        full_name=payload.full_name,
        email=email,
        password_hash=hash_password(payload.password),
        category=payload.category,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return Token(access_token=create_access_token(data={"sub": str(student.id), "role": "student", "email": student.email}))


@router.post("/student/login", response_model=Token)
def student_login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Učenik login — prima email i password, vraća JWT token.
    """
    student = db.query(Student).filter(func.lower(Student.email) == str(payload.email).lower()).first()

    if not student or not verify_password(payload.password, student.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Pogrešan email ili lozinka.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not student.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Učenički nalog je deaktiviran.",
        )

    return Token(access_token=create_access_token(data={"sub": str(student.id), "role": "student", "email": student.email}))
