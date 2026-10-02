"""
Servis za automatsku dodelu učionice.

Pravila:
  - Učionica 1 (velika) ima prioritet
  - Ako je učionica 1 zauzeta, dodeljuje se učionica 2 (mala)
  - Ako su obe zauzete, vraća None (rezervacija se odbija)
  - Maksimalno 2 simultana časa (po jedna učionica)

Race condition zaštita:
  - Koristi SELECT ... FOR UPDATE za zaključavanje redova
  - Poziva se unutar advisory lock-a iz create_booking endpointa
"""

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.booking import Booking

# Ukupan broj učionica
MAX_CLASSROOMS = 2
CLASSROOM_PRIORITY = [1, 2]  # Prvo velika (1), pa mala (2)


def assign_classroom(
    db: Session,
    start_time: datetime,
    end_time: datetime,
    exclude_booking_id: Optional[int] = None,
    lock_rows: bool = False,
    delivery_mode: str = "in_person",
) -> Optional[int]:
    """
    Dodeljuje slobodnu učionicu za dati vremenski raspon.

    Args:
        db: SQLAlchemy sesija
        start_time: Početak časa
        end_time: Kraj časa
        exclude_booking_id: ID bookinga koji treba isključiti
                            (korisno pri preraspodeli/izmeni)
        lock_rows: Ako je True, koristi SELECT ... FOR UPDATE
                   za zaključavanje redova (sprečava race conditions)
        delivery_mode: \"in_person\" — traži fizičku učionicu; \"online\" — bez učionice (0)

    Returns:
        Broj učionice (1 ili 2), 0 za online, ili None ako nema slobodne fizičke učionice.
    """
    if delivery_mode == "online":
        return 0

    # Dohvati sve potvrdjene bookinge koji se preklapaju sa trazenim periodom
    query = (
        db.query(Booking)
        .filter(
            Booking.status == "confirmed",
            Booking.start_time < end_time,
            Booking.end_time > start_time,
        )
    )

    if exclude_booking_id is not None:
        query = query.filter(Booking.id != exclude_booking_id)

    # FOR UPDATE — zaključava redove do kraja transakcije
    if lock_rows:
        query = query.with_for_update()

    overlapping_bookings = query.all()

    # Pronađi koje učionice su zauzete (samo uživo; online ima classroom_number 0)
    occupied_classrooms = {
        b.classroom_number for b in overlapping_bookings if b.classroom_number in (1, 2)
    }

    # Dodeli prvu slobodnu učionicu po prioritetu
    for classroom in CLASSROOM_PRIORITY:
        if classroom not in occupied_classrooms:
            return classroom

    # Obe učionice su zauzete
    return None
