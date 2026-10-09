"""
Seed skripta za inicijalne podatke.

Pokrece se sa:
  python -m app.db.seed

Kreira:
  - admin naloge
  - predmete
  - profesore (odobrene, sa predmetima)
  - test učenike; jedan ima plaćen pristup snimcima za malu i veliku maturu
"""

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.config import settings
from app.core.security import hash_password
from app.models.admin import Admin
from app.models.prep_purchase import PrepPurchase
from app.models.student import Student
from app.models.subject import Subject
from app.models.teacher import Teacher
from app.models.teacher_subject import TeacherSubject
from app.services.prep_catalog import get_exam


# ---- Predmeti ----
SEED_SUBJECTS = [
    "Matematika",
    "Informatika",
    "Srpski jezik",
    "Engleski jezik",
    "Nemački jezik",
    "Ruski jezik",
    "Fizika",
    "Hemija",
]


# ---- Admini ----
SEED_ADMINS = [
    {
        "full_name": "Admin BrainStorm",
        "email": settings.ADMIN_EMAIL,
        "password": settings.ADMIN_PASSWORD,
    },
    {
        "full_name": "Luka Bura",
        "email": "lukabura89@gmail.com",
        "password": "profesor123",
    },
    {
        "full_name": "Marko Bura",
        "email": "markobura99@gmail.com",
        "password": "profesor123",
    },
]


# ---- Profesori i njihovi predmeti ----
SEED_TEACHERS = [
    {
        "full_name": "Luka Bura",
        "email": "lukabura89@gmail.com",
        "password": "profesor123",
        "subjects": ["Matematika", "Informatika"],
    },
    {
        "full_name": "Marko Bura",
        "email": "markobura99@gmail.com",
        "password": "profesor123",
        "subjects": ["Matematika", "Informatika"],
    },
    {
        "full_name": "Sofija Kovac",
        "email": "sofija.kovac@brainstorm.com",
        "password": "profesor123",
        "subjects": ["Matematika", "Informatika"],
    },
    {
        "full_name": "Marija Kovac",
        "email": "marija.kovac@brainstorm.com",
        "password": "profesor123",
        "subjects": ["Engleski jezik", "Srpski jezik"],
    },
    {
        "full_name": "Ivan Radojevic",
        "email": "ivan.radojevic@brainstorm.com",
        "password": "profesor123",
        "subjects": ["Engleski jezik", "Nemački jezik"],
    },
    {
        "full_name": "Nikola Kuruzovic",
        "email": "nikola.kuruzovic@brainstorm.com",
        "password": "profesor123",
        "subjects": ["Matematika", "Fizika"],
    },
    {
        "full_name": "Nemanja Stankovic",
        "email": "nemanja.stankovic@brainstorm.com",
        "password": "profesor123",
        "subjects": ["Engleski jezik", "Informatika", "Matematika"],
    },
    {
        "full_name": "Teodora Taskov",
        "email": "teodora.taskov@brainstorm.com",
        "password": "profesor123",
        "subjects": ["Matematika", "Srpski jezik", "Engleski jezik", "Fizika", "Hemija"],
    },
    {
        "full_name": "Predrag Curcic",
        "email": "predrag.curcic@brainstorm.com",
        "password": "profesor123",
        "subjects": ["Matematika", "Informatika"],
    },
    {
        "full_name": "Nikola",
        "email": "nikola@brainstorm.com",
        "password": "profesor123",
        "subjects": ["Fizika", "Hemija"],
    },
    {
        "full_name": "Stevan Grkavac",
        "email": "stevan.grkavac@brainstorm.com",
        "password": "profesor123",
        "subjects": ["Hemija"],
    },
]


# ---- Test učenik (učenici se inače sami registruju) ----
SEED_STUDENTS = [
    {
        "full_name": "Mina Petrović",
        "email": "mina.petrovic@example.rs",
        "password": "ucenik123",
        "category": "srednja",
    },
    {
        "full_name": "Test Matura",
        "email": "matura@brainstorm.com",
        "password": "matura123",
        "category": "osnovna",
        "prep": ["mala-matura", "velika-matura"],
    },
]


def seed_students(db: Session) -> None:
    """Kreira test učenike i upisuje im plaćen pristup pripremama (ponovljivo)."""
    for s_data in SEED_STUDENTS:
        student = db.query(Student).filter(Student.email == s_data["email"]).first()
        if student:
            print(f"  [skip] Učenik '{s_data['full_name']}' ({s_data['email']}) vec postoji.")
        else:
            student = Student(
                full_name=s_data["full_name"],
                email=s_data["email"],
                password_hash=hash_password(s_data["password"]),
                category=s_data["category"],
                is_active=True,
            )
            db.add(student)
            db.commit()
            db.refresh(student)
            print(f"  [ok] Učenik kreiran: {s_data['full_name']} ({s_data['email']})")

        for exam_slug in s_data.get("prep", []):
            exam = get_exam(exam_slug)
            if not exam:
                print(f"  [!] Priprema '{exam_slug}' ne postoji u katalogu, preskačem.")
                continue
            existing = db.query(PrepPurchase).filter(PrepPurchase.student_id == student.id, PrepPurchase.exam_slug == exam_slug).first()
            if existing:
                print(f"    [skip] Pristup '{exam.title}' vec placen -> {s_data['full_name']}")
                continue
            db.add(PrepPurchase(
                student_id=student.id,
                exam_slug=exam_slug,
                amount_eur=exam.price_eur,
                card_brand="Visa",
                card_last4="4242",
                transaction_id=f"seed_{student.id}_{exam_slug}",
            ))
            db.commit()
            print(f"    [ok] Pristup '{exam.title}' ({exam.price_eur} €) upisan -> {s_data['full_name']}")


def seed_admins(db: Session) -> None:
    """Kreira admin naloge ako ne postoje."""
    for a_data in SEED_ADMINS:
        existing = db.query(Admin).filter(Admin.email == a_data["email"]).first()
        if existing:
            print(f"  [skip] Admin '{a_data['full_name']}' ({a_data['email']}) vec postoji.")
            continue

        admin = Admin(
            full_name=a_data["full_name"],
            email=a_data["email"],
            password_hash=hash_password(a_data["password"]),
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"  [ok] Admin kreiran: {a_data['full_name']} ({a_data['email']})")


def seed_subjects(db: Session) -> None:
    """Kreira predmete ako ne postoje. Deaktivira predmete koji nisu na listi."""
    legacy_german = db.query(Subject).filter(Subject.name == "Nemacki jezik").first()
    correct_german = db.query(Subject).filter(Subject.name == "Nemački jezik").first()
    if legacy_german and not correct_german:
        legacy_german.name = "Nemački jezik"
        db.commit()
        print("  [ok] Ispravljen naziv predmeta: Nemački jezik")

    for name in SEED_SUBJECTS:
        existing = db.query(Subject).filter(Subject.name == name).first()
        if existing:
            if not existing.is_active:
                existing.is_active = True
                db.commit()
                print(f"  [ok] Predmet reaktiviran: {name}")
            else:
                print(f"  [skip] Predmet '{name}' vec postoji.")
            continue

        subject = Subject(name=name, is_active=True)
        db.add(subject)
        db.commit()
        print(f"  [ok] Predmet kreiran: {name}")

    # Deaktiviraj predmete koji nisu na listi
    all_subjects = db.query(Subject).all()
    for subj in all_subjects:
        if subj.name not in SEED_SUBJECTS and subj.is_active:
            subj.is_active = False
            db.commit()
            print(f"  [ok] Predmet deaktiviran (nije na listi): {subj.name}")


def seed_teachers(db: Session) -> None:
    """Kreira profesore sa dodeljenim predmetima."""
    for t_data in SEED_TEACHERS:
        existing = db.query(Teacher).filter(Teacher.email == t_data["email"]).first()
        if existing:
            print(f"  [skip] Profesor '{t_data['full_name']}' ({t_data['email']}) vec postoji.")
            teacher = existing
        else:
            teacher = Teacher(
                full_name=t_data["full_name"],
                email=t_data["email"],
                password_hash=hash_password(t_data["password"]),
                is_active=True,
                is_approved=True,
            )
            db.add(teacher)
            db.commit()
            db.refresh(teacher)
            print(f"  [ok] Profesor kreiran: {t_data['full_name']} ({t_data['email']})")

        # Dodeli predmete
        for subject_name in t_data["subjects"]:
            subject = db.query(Subject).filter(Subject.name == subject_name).first()
            if not subject:
                print(f"  [!] Predmet '{subject_name}' ne postoji, preskačem.")
                continue

            existing_ts = (
                db.query(TeacherSubject)
                .filter(
                    TeacherSubject.teacher_id == teacher.id,
                    TeacherSubject.subject_id == subject.id,
                )
                .first()
            )
            if not existing_ts:
                ts = TeacherSubject(teacher_id=teacher.id, subject_id=subject.id)
                db.add(ts)
                db.commit()
                print(f"    [ok] Predmet '{subject_name}' dodeljen -> {t_data['full_name']}")
            else:
                print(f"    [skip] Predmet '{subject_name}' vec dodeljen -> {t_data['full_name']}")


def run_seed() -> None:
    """Pokrece sve seed funkcije."""
    print("=" * 50)
    print("BrainStorm Booking - Seed")
    print("=" * 50)

    db = SessionLocal()
    try:
        print("\n--- Admini ---")
        seed_admins(db)

        print("\n--- Predmeti ---")
        seed_subjects(db)

        print("\n--- Profesori ---")
        seed_teachers(db)

        print("\n--- Učenici ---")
        seed_students(db)

        print("\n" + "=" * 50)
        print("Seed zavrsen!")
        print("=" * 50)
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
