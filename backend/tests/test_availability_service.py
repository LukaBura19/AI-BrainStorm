"""Testovi generisanja termina, konflikata profesora i kapaciteta učionica."""

from datetime import timedelta

from app.models.teacher import Teacher
from app.models.teacher_subject import TeacherSubject
from app.services.availability_service import get_available_slots
from tests.conftest import TEST_DATE, make_booking, slot_utc


class TestBasicSlotGeneration:
    def test_generates_45min_slots(self, db, teacher, availability):
        slots = get_available_slots(db, teacher.id, TEST_DATE, duration=45)
        assert slots
        assert all((slot["end_time"] - slot["start_time"]).total_seconds() / 60 == 45 for slot in slots)

    def test_generates_60min_slots(self, db, teacher, availability):
        slots = get_available_slots(db, teacher.id, TEST_DATE, duration=60)
        assert slots
        assert all((slot["end_time"] - slot["start_time"]).total_seconds() / 60 == 60 for slot in slots)

    def test_generates_90min_slots(self, db, teacher, availability):
        slots = get_available_slots(db, teacher.id, TEST_DATE, duration=90)
        assert slots
        assert all((slot["end_time"] - slot["start_time"]).total_seconds() / 60 == 90 for slot in slots)

    def test_no_availability_returns_empty(self, db, teacher):
        assert get_available_slots(db, teacher.id, TEST_DATE, duration=45) == []

    def test_wrong_date_returns_empty(self, db, teacher, availability):
        assert get_available_slots(db, teacher.id, TEST_DATE + timedelta(days=1), duration=45) == []

    def test_slots_start_at_availability_start(self, db, teacher, availability):
        slots = get_available_slots(db, teacher.id, TEST_DATE, duration=45)
        assert slots[0]["start_time"] == slot_utc(8)

    def test_last_slot_ends_within_availability(self, db, teacher, availability):
        slots = get_available_slots(db, teacher.id, TEST_DATE, duration=45)
        assert slots[-1]["end_time"] <= slot_utc(16)

    def test_90min_fewer_slots_than_45min(self, db, teacher, availability):
        slots_45 = get_available_slots(db, teacher.id, TEST_DATE, duration=45)
        slots_90 = get_available_slots(db, teacher.id, TEST_DATE, duration=90)
        assert len(slots_90) < len(slots_45)


class TestTeacherConflict:
    def test_slot_removed_when_teacher_has_booking(self, db, teacher, subject, availability, teacher_subject_link):
        make_booking(db, teacher, subject, start_time=slot_utc(9), duration=45)
        starts = [slot["start_time"] for slot in get_available_slots(db, teacher.id, TEST_DATE, duration=45)]
        assert slot_utc(9) not in starts

    def test_overlapping_slots_removed(self, db, teacher, subject, availability, teacher_subject_link):
        make_booking(db, teacher, subject, start_time=slot_utc(10), duration=90)
        slots = get_available_slots(db, teacher.id, TEST_DATE, duration=45)
        for slot in slots:
            assert not (slot["start_time"] < slot_utc(11, 30) and slot["end_time"] > slot_utc(10))

    def test_cancelled_booking_doesnt_block(self, db, teacher, subject, availability, teacher_subject_link):
        make_booking(db, teacher, subject, start_time=slot_utc(9), duration=45, status="cancelled")
        starts = [slot["start_time"] for slot in get_available_slots(db, teacher.id, TEST_DATE, duration=45)]
        assert slot_utc(9) in starts


class TestClassroomCapacity:
    def test_one_booking_leaves_slot_available(self, db, teacher, teacher2, subject, availability, teacher_subject_link):
        make_booking(db, teacher2, subject, start_time=slot_utc(9), duration=45, classroom=1)
        starts = [slot["start_time"] for slot in get_available_slots(db, teacher.id, TEST_DATE, duration=45)]
        assert slot_utc(9) in starts

    def test_two_bookings_block_slot(self, db, teacher, teacher2, subject, subject2, availability, teacher_subject_link):
        third = Teacher(full_name="Prof Tri", email="tri@t.com", password_hash="x", is_active=True, is_approved=True)
        db.add(third)
        db.flush()
        make_booking(db, teacher2, subject, start_time=slot_utc(9), duration=45, classroom=1)
        make_booking(db, third, subject2, start_time=slot_utc(9), duration=45, classroom=2)
        starts = [slot["start_time"] for slot in get_available_slots(db, teacher.id, TEST_DATE, duration=45)]
        assert slot_utc(9) not in starts

    def test_online_mode_ignores_classroom_capacity(self, db, teacher, teacher2, subject, subject2, availability, teacher_subject_link):
        third = Teacher(full_name="Prof Tri", email="tri@t.com", password_hash="x", is_active=True, is_approved=True)
        db.add(third)
        db.flush()
        db.add(TeacherSubject(teacher_id=third.id, subject_id=subject2.id))
        db.flush()
        make_booking(db, teacher2, subject, start_time=slot_utc(9), duration=45, classroom=1)
        make_booking(db, third, subject2, start_time=slot_utc(9), duration=45, classroom=2)
        starts_in_person = [slot["start_time"] for slot in get_available_slots(db, teacher.id, TEST_DATE, duration=45, delivery_mode="in_person")]
        starts_online = [slot["start_time"] for slot in get_available_slots(db, teacher.id, TEST_DATE, duration=45, delivery_mode="online")]
        assert slot_utc(9) not in starts_in_person
        assert slot_utc(9) in starts_online

    def test_adjacent_bookings_dont_block(self, db, teacher, teacher2, subject, availability, teacher_subject_link):
        make_booking(db, teacher2, subject, start_time=slot_utc(9), duration=45, classroom=1)
        starts = [slot["start_time"] for slot in get_available_slots(db, teacher.id, TEST_DATE, duration=45)]
        assert slot_utc(10) in starts
