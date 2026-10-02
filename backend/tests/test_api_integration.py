"""
Integracioni testovi API-ja (Ticket 37) — glavni HTTP tokovi end-to-end.

Pokriva: login, javni listing + termini + booking, otkazivanje (klijent, admin, profesor).
"""

from datetime import datetime, timedelta, timezone

from tests.booking_form import booking_multipart_data
from tests.conftest import TEST_DATE, make_booking, slot_local_iso, slot_utc


class TestAuthIntegration:
    """POST /auth/admin/login i /auth/teacher/login."""

    def test_admin_login_success(self, client, admin_user):
        r = client.post(
            "/auth/admin/login",
            json={"email": "admin@test.com", "password": "admin123"},
        )
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert len(body["access_token"]) > 20

    def test_admin_login_wrong_password(self, client, admin_user):
        r = client.post(
            "/auth/admin/login",
            json={"email": "admin@test.com", "password": "pogresna"},
        )
        assert r.status_code == 401

    def test_teacher_login_success(self, client, teacher):
        r = client.post(
            "/auth/teacher/login",
            json={"email": "petar@test.com", "password": "test123"},
        )
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_teacher_login_unapproved_forbidden(self, client, teacher_unapproved):
        r = client.post(
            "/auth/teacher/login",
            json={"email": "neo@test.com", "password": "test123"},
        )
        assert r.status_code == 403


class TestPublicBookingFlowIntegration:
    """Javni lanac: predmeti → profesori → termini → rezervacija → manje slobodnih termina."""

    def test_subjects_teachers_slots_and_booking(
        self, client, db, teacher, subject, teacher_subject_link, availability
    ):
        r_sub = client.get("/public/subjects")
        assert r_sub.status_code == 200
        subjects = r_sub.json()["items"]
        assert any(s["id"] == subject.id and s["name"] == "Matematika" for s in subjects)

        r_teach = client.get(f"/public/teachers?subject_id={subject.id}")
        assert r_teach.status_code == 200
        teachers = r_teach.json()["items"]
        assert any(t["id"] == teacher.id for t in teachers)

        r_slots = client.get(
            "/public/available-slots",
            params={
                "teacher_id": teacher.id,
                "date": TEST_DATE.isoformat(),
                "duration": 45,
                "delivery_mode": "in_person",
            },
        )
        assert r_slots.status_code == 200
        before = r_slots.json()
        assert before["total"] >= 1
        starts_before = [datetime.fromisoformat(s["start_time"]) for s in before["slots"]]
        assert slot_utc(9) in starts_before

        r_book = client.post(
            "/public/bookings",
            data=booking_multipart_data(
                subject_id=subject.id,
                teacher_id=teacher.id,
                start_time=slot_local_iso(9),
                duration=45,
                client_full_name="Integracija",
                client_email="int@test.com",
                client_category="faks",
            ),
        )
        assert r_book.status_code == 201

        r_slots_after = client.get(
            "/public/available-slots",
            params={
                "teacher_id": teacher.id,
                "date": TEST_DATE.isoformat(),
                "duration": 45,
                "delivery_mode": "in_person",
            },
        )
        assert r_slots_after.status_code == 200
        after = r_slots_after.json()
        # Jedna rezervacija može ukloniti više preklapajućih ponuđenih prozora (npr. 30 → 25).
        assert after["total"] < before["total"]
        starts_after = [datetime.fromisoformat(s["start_time"]) for s in after["slots"]]
        assert slot_utc(9) not in starts_after


class TestCancellationIntegration:
    """Otkazivanje preko javnog tokena, admina i profesora."""

    def test_client_cancel_happy_path(self, client, db, teacher, subject, teacher_subject_link, availability):
        future = datetime.now(timezone.utc) + timedelta(hours=48)
        b = make_booking(db, teacher, subject, start_time=future, duration=45)
        token = b.client_cancel_token
        db.commit()

        r = client.post("/public/bookings/cancel", json={"token": token})
        assert r.status_code == 200
        assert r.json()["status"] == "cancelled"

    def test_admin_cancel_happy_path(self, client, db, admin_user, teacher, subject, teacher_subject_link):
        future = datetime.now(timezone.utc) + timedelta(hours=48)
        b = make_booking(db, teacher, subject, start_time=future, duration=45)
        db.commit()

        login = client.post(
            "/auth/admin/login",
            json={"email": "admin@test.com", "password": "admin123"},
        )
        assert login.status_code == 200
        tok = login.json()["access_token"]

        r = client.patch(
            f"/admin/bookings/{b.id}/cancel",
            params={"reason": "Integracioni test"},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 200
        assert r.json()["booking_id"] == b.id

    def test_teacher_cancel_happy_path(self, client, db, teacher, subject, teacher_subject_link):
        future = datetime.now(timezone.utc) + timedelta(hours=48)
        b = make_booking(db, teacher, subject, start_time=future, duration=45)
        db.commit()

        login = client.post(
            "/auth/teacher/login",
            json={"email": "petar@test.com", "password": "test123"},
        )
        assert login.status_code == 200
        tok = login.json()["access_token"]

        r = client.patch(
            f"/teacher/bookings/{b.id}/cancel",
            params={"reason": "Bolovanje"},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 200
        assert r.json()["booking_id"] == b.id

    def test_admin_cancel_without_token_unauthorized(self, client, db, teacher, subject):
        future = datetime.now(timezone.utc) + timedelta(hours=48)
        b = make_booking(db, teacher, subject, start_time=future, duration=45)
        db.commit()

        r = client.patch(f"/admin/bookings/{b.id}/cancel")
        assert r.status_code == 401
