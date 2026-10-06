"""
Test konfiguracija — koristi istu PostgreSQL bazu ali zasebnu test bazu.

Fiksture:
  - db: SQLAlchemy sesija sa rollback-om posle svakog testa
  - client: FastAPI TestClient sa overrideovanom sesijom
  - seed_data: osnovi podaci (admin, subject, teacher, availability)
"""

import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.admin import Admin
from app.models.booking import Booking
from app.models.subject import Subject
from app.models.teacher import Teacher
from app.models.teacher_availability import TeacherAvailability
from app.models.teacher_subject import TeacherSubject
from app.utils.datetime_utils import local_today

# Test baza — ista kao glavna ali sa _test sufiksom
TEST_DB_URL = settings.DATABASE_URL.rsplit("/", 1)[0] + "/brainstorm_test"
TEST_DATE = local_today() + timedelta(days=30)
TEST_TIMEZONE = ZoneInfo(settings.APP_TIMEZONE)


def slot_utc(hour: int, minute: int = 0):
    """UTC instant za lokalno vreme testnog dana u centru."""
    return datetime.combine(
        TEST_DATE,
        datetime.min.time(),
        tzinfo=TEST_TIMEZONE,
    ).replace(hour=hour, minute=minute).astimezone(timezone.utc)


def slot_local_iso(hour: int, minute: int = 0) -> str:
    """Naivni lokalni ISO format kakav šalje browser."""
    return f"{TEST_DATE.isoformat()}T{hour:02d}:{minute:02d}:00"


def _ensure_test_db():
    """Kreira test bazu ako ne postoji."""
    base_url = settings.DATABASE_URL.rsplit("/", 1)[0] + "/postgres"
    eng = create_engine(base_url, isolation_level="AUTOCOMMIT")
    with eng.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = 'brainstorm_test'")
        ).fetchone()
        if not exists:
            conn.execute(text("CREATE DATABASE brainstorm_test"))
    eng.dispose()


_ensure_test_db()

engine = create_engine(TEST_DB_URL, pool_pre_ping=True)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    """Kreira tabele na početku test sesije, briše na kraju."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    """Daje sesiju sa rollback-om posle svakog testa."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestSession(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db):
    """FastAPI TestClient koji koristi test sesiju."""
    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def disable_transactional_email(monkeypatch):
    """Testovi ne kontaktiraju SMTP; posebni email testovi mogu ovo da premoste."""
    monkeypatch.setattr(settings, "MAIL_ENABLED", False)


@pytest.fixture(autouse=True)
def disable_claude_api(monkeypatch):
    """Testovi nikad ne zovu pravi Claude API; testovi asistenta ubacuju lažnog klijenta."""
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "")


# =============================================
#  Seed fiksture
# =============================================

@pytest.fixture()
def subject(db) -> Subject:
    """Kreira aktivan predmet 'Matematika'."""
    s = Subject(name="Matematika", is_active=True)
    db.add(s)
    db.flush()
    return s


@pytest.fixture()
def subject2(db) -> Subject:
    """Drugi aktivan predmet."""
    s = Subject(name="Fizika", is_active=True)
    db.add(s)
    db.flush()
    return s


@pytest.fixture()
def teacher(db) -> Teacher:
    """Kreira aktivnog i odobrenog profesora."""
    t = Teacher(
        full_name="Prof Petar",
        email="petar@test.com",
        password_hash=hash_password("test123"),
        is_active=True,
        is_approved=True,
    )
    db.add(t)
    db.flush()
    return t


@pytest.fixture()
def teacher2(db) -> Teacher:
    """Drugi profesor."""
    t = Teacher(
        full_name="Prof Ana",
        email="ana@test.com",
        password_hash=hash_password("test123"),
        is_active=True,
        is_approved=True,
    )
    db.add(t)
    db.flush()
    return t


@pytest.fixture()
def teacher_unapproved(db) -> Teacher:
    """Aktivan ali neodobren profesor (login treba da vrati 403)."""
    t = Teacher(
        full_name="Prof Neo",
        email="neo@test.com",
        password_hash=hash_password("test123"),
        is_active=True,
        is_approved=False,
    )
    db.add(t)
    db.flush()
    return t


@pytest.fixture()
def teacher_subject_link(db, teacher, subject) -> TeacherSubject:
    """Povezuje profesora sa predmetom."""
    link = TeacherSubject(teacher_id=teacher.id, subject_id=subject.id)
    db.add(link)
    db.flush()
    return link


@pytest.fixture()
def availability(db, teacher) -> TeacherAvailability:
    """Raspoloživost profesora na budućem testnom danu, 08:00-16:00 lokalno."""
    a = TeacherAvailability(
        teacher_id=teacher.id,
        start_time=slot_utc(8),
        end_time=slot_utc(16),
        is_available=True,
    )
    db.add(a)
    db.flush()
    return a


@pytest.fixture()
def admin_user(db) -> Admin:
    """Kreira admin korisnika."""
    a = Admin(
        full_name="Test Admin",
        email="admin@test.com",
        password_hash=hash_password("admin123"),
    )
    db.add(a)
    db.flush()
    return a


def make_booking(
    db,
    teacher,
    subject,
    start_time,
    duration=45,
    classroom=1,
    status="confirmed",
    delivery_mode="in_person",
    session_type="individual",
):
    """Helper za brzo kreiranje bookinga u testovima."""
    end_time = start_time + timedelta(minutes=duration)
    if delivery_mode == "online":
        classroom = 0
    b = Booking(
        subject_id=subject.id,
        teacher_id=teacher.id,
        client_full_name="Test Klijent",
        client_email="klijent@test.com",
        client_category="faks",
        client_note=None,
        delivery_mode=delivery_mode,
        session_type=session_type,
        start_time=start_time,
        end_time=end_time,
        duration_minutes=duration,
        status=status,
        classroom_number=classroom,
        client_cancel_token=secrets.token_urlsafe(16),
    )
    db.add(b)
    db.flush()
    return b
