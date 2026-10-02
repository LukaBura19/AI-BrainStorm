"""
Servis za racunanje dostupnih termina.

Ovo je srce booking sistema — uzima u obzir:
  1. Raspolozivost profesora (teacher_availabilities)
  2. Trajanje casa (45, 60, 90 min)
  3. Vec postojece rezervacije profesora (bookings)
  4. Globalni kapacitet ucionica (max 2 simultana casa)
"""

from datetime import date, datetime, timedelta, timezone
from typing import List

from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.teacher_availability import TeacherAvailability
from app.utils.datetime_utils import local_day_bounds_utc


# Korak izmedju potencijalnih termina (u minutima) — 30 min (8:00, 8:30, 9:00, …)
SLOT_STEP_MINUTES = 30


def get_available_slots(
    db: Session,
    teacher_id: int,
    target_date: date,
    duration: int,
    step_minutes: int = SLOT_STEP_MINUTES,
    delivery_mode: str = "in_person",
) -> List[dict]:
    """
    Izracunava dostupne termine za profesora na zadati datum.

    Args:
        db: SQLAlchemy sesija
        teacher_id: ID profesora
        target_date: Datum za koji se traze termini
        duration: Trajanje casa u minutima (45, 60, 90)
        step_minutes: Korak izmedju kandidat termina (default 30 min)

    Returns:
        Lista dict-ova sa start_time i end_time za svaki dostupan termin.
    """

    if duration not in (45, 60, 90):
        raise ValueError("Trajanje casa mora biti 45, 60 ili 90 minuta.")

    if delivery_mode not in ("online", "in_person"):
        raise ValueError("delivery_mode mora biti 'online' ili 'in_person'.")

    duration_td = timedelta(minutes=duration)
    step_td = timedelta(minutes=step_minutes)

    # Granice kalendarskog dana centra, prevedene u UTC. Ovo je važno i na
    # prelasku letnje/zimskog računanja vremena.
    day_start, day_end = local_day_bounds_utc(target_date)
    now_utc = datetime.now(timezone.utc)

    # -------------------------------------------------------
    # 1. Dohvati raspolozivost profesora za taj dan
    # -------------------------------------------------------
    availabilities = (
        db.query(TeacherAvailability)
        .filter(
            TeacherAvailability.teacher_id == teacher_id,
            TeacherAvailability.is_available == True,  # noqa: E712
            # Raspolozivost se preklapa sa trazenim danom
            TeacherAvailability.start_time < day_end,
            TeacherAvailability.end_time > day_start,
        )
        .order_by(TeacherAvailability.start_time)
        .all()
    )

    if not availabilities:
        return []

    # -------------------------------------------------------
    # 2. Dohvati postojece potvrdjene rezervacije profesora
    # -------------------------------------------------------
    teacher_bookings = (
        db.query(Booking)
        .filter(
            Booking.teacher_id == teacher_id,
            Booking.status == "confirmed",
            Booking.start_time < day_end,
            Booking.end_time > day_start,
        )
        .all()
    )

    # -------------------------------------------------------
    # 3. Dohvati SVE potvrdjene rezervacije na taj dan
    #    (za proveru globalnog kapaciteta ucionica)
    # -------------------------------------------------------
    all_bookings = (
        db.query(Booking)
        .filter(
            Booking.status == "confirmed",
            Booking.start_time < day_end,
            Booking.end_time > day_start,
        )
        .all()
    )

    # -------------------------------------------------------
    # 4. Generisi kandidat termine iz raspolozivosti
    # -------------------------------------------------------
    available_slots = []
    seen_slots: set[tuple[datetime, datetime]] = set()

    for avail in availabilities:
        # Klipuj raspolozivost na granice trazenog dana
        avail_start = max(avail.start_time, day_start)
        avail_end = min(avail.end_time, day_end)

        current = avail_start
        while current + duration_td <= avail_end:
            slot_start = current
            slot_end = current + duration_td

            # Nikada ne nudimo termin koji je već počeo. Frontend trenutno
            # prikazuje buduće dane, ali API mora biti ispravan i samostalno.
            if slot_start <= now_utc:
                current += step_td
                continue

            # -----------------------------------------------
            # 4a. Da li se preklapa sa rezervacijom profesora?
            # -----------------------------------------------
            teacher_conflict = _has_overlap(slot_start, slot_end, teacher_bookings)

            if not teacher_conflict:
                # -------------------------------------------
                # 4b. Kapacitet učionica (samo za uživo; online ne troši fizičku učionicu)
                # -------------------------------------------
                if delivery_mode == "online":
                    slot_key = (slot_start, slot_end)
                    if slot_key not in seen_slots:
                        seen_slots.add(slot_key)
                        available_slots.append(
                            {"start_time": slot_start, "end_time": slot_end}
                        )
                else:
                    overlapping_count = _count_in_person_room_overlaps(
                        slot_start, slot_end, all_bookings
                    )
                    if overlapping_count < 2:
                        slot_key = (slot_start, slot_end)
                        if slot_key not in seen_slots:
                            seen_slots.add(slot_key)
                            available_slots.append(
                                {
                                    "start_time": slot_start,
                                    "end_time": slot_end,
                                }
                            )

            current += step_td

    return sorted(available_slots, key=lambda slot: slot["start_time"])


def _has_overlap(
    slot_start: datetime,
    slot_end: datetime,
    bookings: list,
) -> bool:
    """Proverava da li se slot preklapa sa bilo kojom rezervacijom."""
    for booking in bookings:
        if booking.start_time < slot_end and booking.end_time > slot_start:
            return True
    return False


def _count_overlapping(
    slot_start: datetime,
    slot_end: datetime,
    bookings: list,
) -> int:
    """Broji koliko se rezervacija preklapa sa datim slotom."""
    count = 0
    for booking in bookings:
        if booking.start_time < slot_end and booking.end_time > slot_start:
            count += 1
    return count


def _count_in_person_room_overlaps(
    slot_start: datetime,
    slot_end: datetime,
    bookings: list,
) -> int:
    """Broji koliko uživo rezervacija zauzima fizičku učionicu u datom intervalu."""
    count = 0
    for booking in bookings:
        if booking.start_time < slot_end and booking.end_time > slot_start:
            if booking.classroom_number in (1, 2):
                count += 1
    return count
