"""Ponovljiv seed buduće raspoloživosti test profesora Luke Bure.

Pokretanje:
  docker compose exec backend python -m app.db.seed_luka_test_data

Dodaje prozore 08:00–20:00 za narednih 14 dana u zoni centra. Postojeće
preklapajuće prozore ne duplira i ne menja rezervacije drugih korisnika.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.teacher import Teacher
from app.models.teacher_availability import TeacherAvailability
from app.utils.datetime_utils import app_timezone, local_today

TEACHER_EMAIL = "lukabura89@gmail.com"
NUMBER_OF_DAYS = 14
DAY_START_HOUR = 8
DAY_END_HOUR = 20


def seed_luka_future_availability(db: Session) -> tuple[int, int]:
    teacher = db.query(Teacher).filter(Teacher.email == TEACHER_EMAIL).first()
    if not teacher:
        raise SystemExit(
            f"Profesor {TEACHER_EMAIL} ne postoji. Prvo pokreni: python -m app.db.seed"
        )

    timezone_local = app_timezone()
    first_day = local_today() + timedelta(days=1)
    added = 0
    skipped = 0

    for offset in range(NUMBER_OF_DAYS):
        day = first_day + timedelta(days=offset)
        start_utc = datetime(
            day.year, day.month, day.day, DAY_START_HOUR, tzinfo=timezone_local
        ).astimezone(timezone.utc)
        end_utc = datetime(
            day.year, day.month, day.day, DAY_END_HOUR, tzinfo=timezone_local
        ).astimezone(timezone.utc)

        overlap = (
            db.query(TeacherAvailability)
            .filter(
                TeacherAvailability.teacher_id == teacher.id,
                TeacherAvailability.is_available.is_(True),
                TeacherAvailability.start_time < end_utc,
                TeacherAvailability.end_time > start_utc,
            )
            .first()
        )
        if overlap:
            skipped += 1
            print(f"  [skip] {day.isoformat()} već ima raspoloživost")
            continue

        db.add(
            TeacherAvailability(
                teacher_id=teacher.id,
                start_time=start_utc,
                end_time=end_utc,
                is_available=True,
            )
        )
        added += 1
        print(f"  [ok] {day.isoformat()} 08:00–20:00 ({settings.APP_TIMEZONE})")

    db.commit()
    return added, skipped


def main() -> None:
    print(f"Buduća raspoloživost: Luka Bura ({TEACHER_EMAIL})")
    db = SessionLocal()
    try:
        added, skipped = seed_luka_future_availability(db)
    finally:
        db.close()
    print(f"Gotovo: dodato {added}, preskočeno {skipped}.")


if __name__ == "__main__":
    main()
