"""
Testovi za classroom_service — automatska dodela učionica.

Pokriva:
  - Prioritet: učionica 1 pa 2
  - Odbijanje kada su obe zauzete
  - exclude_booking_id za preraspodelu
"""

from datetime import datetime, timezone

from tests.conftest import make_booking
from app.services.classroom_service import assign_classroom


class TestClassroomAssignment:
    """Testira logiku dodele učionica."""

    def test_empty_schedule_assigns_classroom_1(self, db):
        """Bez bookinga, dodeljuje učionicu 1 (prioritet)."""
        result = assign_classroom(
            db,
            start_time=datetime(2026, 3, 23, 9, 0, tzinfo=timezone.utc),
            end_time=datetime(2026, 3, 23, 9, 45, tzinfo=timezone.utc),
        )
        assert result == 1

    def test_classroom_1_taken_assigns_classroom_2(self, db, teacher, subject, teacher_subject_link, availability):
        """Učionica 1 zauzeta → dodeljuje učionicu 2."""
        make_booking(
            db, teacher, subject,
            start_time=datetime(2026, 3, 23, 9, 0, tzinfo=timezone.utc),
            duration=45, classroom=1,
        )
        result = assign_classroom(
            db,
            start_time=datetime(2026, 3, 23, 9, 0, tzinfo=timezone.utc),
            end_time=datetime(2026, 3, 23, 9, 45, tzinfo=timezone.utc),
        )
        assert result == 2

    def test_both_classrooms_taken_returns_none(self, db, teacher, teacher2, subject, teacher_subject_link, availability):
        """Obe učionice zauzete → vraća None."""
        make_booking(
            db, teacher, subject,
            start_time=datetime(2026, 3, 23, 9, 0, tzinfo=timezone.utc),
            duration=45, classroom=1,
        )
        make_booking(
            db, teacher2, subject,
            start_time=datetime(2026, 3, 23, 9, 0, tzinfo=timezone.utc),
            duration=45, classroom=2,
        )
        result = assign_classroom(
            db,
            start_time=datetime(2026, 3, 23, 9, 0, tzinfo=timezone.utc),
            end_time=datetime(2026, 3, 23, 9, 45, tzinfo=timezone.utc),
        )
        assert result is None

    def test_cancelled_booking_frees_classroom(self, db, teacher, subject, teacher_subject_link, availability):
        """Otkazani booking ne zauzima učionicu."""
        make_booking(
            db, teacher, subject,
            start_time=datetime(2026, 3, 23, 9, 0, tzinfo=timezone.utc),
            duration=45, classroom=1, status="cancelled",
        )
        result = assign_classroom(
            db,
            start_time=datetime(2026, 3, 23, 9, 0, tzinfo=timezone.utc),
            end_time=datetime(2026, 3, 23, 9, 45, tzinfo=timezone.utc),
        )
        assert result == 1

    def test_non_overlapping_booking_doesnt_affect(self, db, teacher, subject, teacher_subject_link, availability):
        """Booking u drugom terminu ne utiče na dodelu."""
        make_booking(
            db, teacher, subject,
            start_time=datetime(2026, 3, 23, 10, 0, tzinfo=timezone.utc),
            duration=45, classroom=1,
        )
        result = assign_classroom(
            db,
            start_time=datetime(2026, 3, 23, 9, 0, tzinfo=timezone.utc),
            end_time=datetime(2026, 3, 23, 9, 45, tzinfo=timezone.utc),
        )
        assert result == 1

    def test_exclude_booking_id(self, db, teacher, subject, teacher_subject_link, availability):
        """exclude_booking_id ignoriše taj booking (za admin reassign)."""
        b = make_booking(
            db, teacher, subject,
            start_time=datetime(2026, 3, 23, 9, 0, tzinfo=timezone.utc),
            duration=45, classroom=1,
        )
        result = assign_classroom(
            db,
            start_time=datetime(2026, 3, 23, 9, 0, tzinfo=timezone.utc),
            end_time=datetime(2026, 3, 23, 9, 45, tzinfo=timezone.utc),
            exclude_booking_id=b.id,
        )
        # Treba dobiti učionicu 1 jer je booking isključen
        assert result == 1

    def test_partial_overlap_blocks_classroom(self, db, teacher, subject, teacher_subject_link, availability):
        """Delimično preklapanje zauzima učionicu."""
        # Booking 08:30-09:15
        make_booking(
            db, teacher, subject,
            start_time=datetime(2026, 3, 23, 8, 30, tzinfo=timezone.utc),
            duration=45, classroom=1,
        )
        # Tražimo 09:00-09:45 — preklapa se sa 08:30-09:15
        result = assign_classroom(
            db,
            start_time=datetime(2026, 3, 23, 9, 0, tzinfo=timezone.utc),
            end_time=datetime(2026, 3, 23, 9, 45, tzinfo=timezone.utc),
        )
        assert result == 2  # Učionica 1 zauzeta, dodeljuje se 2

    def test_online_delivery_returns_zero_without_physical_room(self, db):
        """Online rezervacija ne traži fizičku učionicu (uvek 0)."""
        result = assign_classroom(
            db,
            start_time=datetime(2026, 3, 23, 9, 0, tzinfo=timezone.utc),
            end_time=datetime(2026, 3, 23, 9, 45, tzinfo=timezone.utc),
            delivery_mode="online",
        )
        assert result == 0
