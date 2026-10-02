"""Centralizovana pravila za vreme Edukativnog centra BrainStorm."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings


def app_timezone() -> ZoneInfo:
    """Vremenska zona u kojoj centar prikazuje i unosi termine."""
    return ZoneInfo(settings.APP_TIMEZONE)


def normalize_to_utc(value: datetime) -> datetime:
    """
    Vraća timezone-aware UTC datetime.

    Stariji klijenti su slali vreme bez offset-a. Takvu vrednost tumačimo kao
    lokalno vreme centra (ne kao UTC), čime izbegavamo pomeranje termina.
    """
    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=app_timezone())
    return value.astimezone(timezone.utc)


def to_app_timezone(value: datetime) -> datetime:
    """Pretvara vrednost iz baze/API-ja u lokalno vreme centra."""
    return normalize_to_utc(value).astimezone(app_timezone())


def local_day_bounds_utc(target_date: date) -> tuple[datetime, datetime]:
    """UTC granice lokalnog dana, kao poluotvoren interval [start, end)."""
    tz = app_timezone()
    start_local = datetime.combine(target_date, time.min, tzinfo=tz)
    # Kombinovanje sledećeg kalendarskog dana je bezbedno i na DST prelazima.
    from datetime import timedelta

    end_local = datetime.combine(target_date + timedelta(days=1), time.min, tzinfo=tz)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def local_today() -> date:
    return datetime.now(app_timezone()).date()
