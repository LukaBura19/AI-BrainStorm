"""
Admin: pregled i (de)aktivacija učeničkih naloga, i obaveštenja posle prebacivanja časa.
"""

from datetime import datetime, timedelta, timezone

from app.api import admin as admin_api
from app.models.teacher_availability import TeacherAvailability
from app.models.teacher_subject import TeacherSubject
from app.services import email_service
from tests.booking_form import booking_multipart_data
from tests.conftest import make_booking, slot_local_iso, slot_utc


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def admin_token(client):
    resp = client.post("/auth/admin/login", json={"email": "admin@test.com", "password": "admin123"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def register_student(client, email="mina@test.com"):
    resp = client.post("/auth/student/register", json={"full_name": "Mina Test", "email": email, "password": "lozinka123", "category": "osnovna"})
    assert resp.status_code == 201
    return resp.json()["access_token"]


class TestAdminStudents:
    def test_list_shows_accounts_with_lesson_counts(self, client, admin_user, teacher, subject, teacher_subject_link, availability):
        student_token = register_student(client)
        booked = client.post(
            "/public/bookings",
            data=booking_multipart_data(
                subject_id=subject.id, teacher_id=teacher.id, start_time=slot_local_iso(10), duration=45,
                client_full_name="Mina Test", client_email="mina@test.com", client_category="osnovna",
            ),
            headers=auth(student_token),
        )
        assert booked.status_code == 201
        register_student(client, email="bez.casova@test.com")

        resp = client.get("/admin/students", headers=auth(admin_token(client)))
        assert resp.status_code == 200
        rows = {row["email"]: row for row in resp.json()["items"]}
        assert rows["mina@test.com"]["bookings_total"] == 1
        assert rows["mina@test.com"]["bookings_upcoming"] == 1
        assert rows["mina@test.com"]["category"] == "osnovna"
        assert rows["mina@test.com"]["is_active"] is True
        assert rows["bez.casova@test.com"]["bookings_total"] == 0

    def test_only_admin_can_list_students(self, client, admin_user):
        student_token = register_student(client)
        assert client.get("/admin/students").status_code == 401
        assert client.get("/admin/students", headers=auth(student_token)).status_code == 401

    def test_deactivated_student_cannot_sign_in_and_can_be_reactivated(self, client, admin_user):
        register_student(client)
        token = admin_token(client)
        student_id = next(row["id"] for row in client.get("/admin/students", headers=auth(token)).json()["items"])

        off = client.patch(f"/admin/students/{student_id}", json={"is_active": False}, headers=auth(token))
        assert off.status_code == 200 and off.json()["is_active"] is False
        login = client.post("/auth/student/login", json={"email": "mina@test.com", "password": "lozinka123"})
        assert login.status_code == 403

        on = client.patch(f"/admin/students/{student_id}", json={"is_active": True}, headers=auth(token))
        assert on.json()["is_active"] is True
        assert client.post("/auth/student/login", json={"email": "mina@test.com", "password": "lozinka123"}).status_code == 200

    def test_unknown_student_is_404(self, client, admin_user):
        resp = client.patch("/admin/students/999999", json={"is_active": False}, headers=auth(admin_token(client)))
        assert resp.status_code == 404


class TestReassignNotifications:
    def test_reassign_to_other_teacher_notifies_both_teachers(self, client, db, admin_user, teacher, teacher2, subject, teacher_subject_link, availability, monkeypatch):
        db.add(TeacherSubject(teacher_id=teacher2.id, subject_id=subject.id))
        db.add(TeacherAvailability(teacher_id=teacher2.id, start_time=slot_utc(8), end_time=slot_utc(16), is_available=True))
        booking = make_booking(db, teacher, subject, slot_utc(9))
        db.commit()

        calls = []
        def fake_send(**kwargs):
            calls.append(kwargs)
            return {"sent": 4, "failed": 0, "total": 4, "status": "sent"}
        monkeypatch.setattr(admin_api, "send_booking_change_notification", fake_send)

        resp = client.patch(f"/admin/bookings/{booking.id}/reassign", json={"teacher_id": teacher2.id}, headers=auth(admin_token(client)))
        assert resp.status_code == 200, resp.text
        assert resp.json()["teacher_name"] == teacher2.full_name
        assert resp.json()["notification_delivery"]["status"] == "sent"
        assert len(calls) == 1
        assert calls[0]["teacher_email"] == teacher2.email
        assert calls[0]["previous_teacher_email"] == teacher.email
        assert calls[0]["cancel_url"].endswith(f"/cancel/{booking.client_cancel_token}")

    def test_email_failure_does_not_undo_the_reassign(self, client, db, admin_user, teacher, subject, teacher_subject_link, availability, monkeypatch):
        booking = make_booking(db, teacher, subject, slot_utc(9))
        db.commit()
        def broken(**_kwargs):
            raise RuntimeError("SMTP pao")
        monkeypatch.setattr(admin_api, "send_booking_change_notification", broken)

        resp = client.patch(f"/admin/bookings/{booking.id}/reassign", json={"start_time": slot_local_iso(11)}, headers=auth(admin_token(client)))
        assert resp.status_code == 200
        assert resp.json()["notification_delivery"]["status"] == "failed"
        assert datetime.fromisoformat(resp.json()["start_time"].replace("Z", "+00:00")) == slot_utc(11)


def test_change_email_reaches_previous_teacher_only_when_teacher_changed(monkeypatch):
    sent = []
    monkeypatch.setattr(email_service, "send_email", lambda **kwargs: sent.append(kwargs) or True)
    data = {
        "subject_name": "Matematika", "teacher_name": "Prof Ana", "client_full_name": "Mina",
        "client_email": "mina@test.com", "client_category": "osnovna",
        "start_time": datetime.now(timezone.utc) + timedelta(days=3),
        "end_time": datetime.now(timezone.utc) + timedelta(days=3, minutes=45),
        "duration_minutes": 45, "classroom_number": 1,
    }
    email_service.send_booking_change_notification(data, "mina@test.com", "ana@test.com", "admin@test.com", previous_teacher_email="petar@test.com")
    assert sorted(item["to"] for item in sent) == ["admin@test.com", "ana@test.com", "mina@test.com", "petar@test.com"]
    previous = next(item for item in sent if item["to"] == "petar@test.com")
    assert "više nije" in previous["subject"]

    sent.clear()
    email_service.send_booking_change_notification(data, "mina@test.com", "ana@test.com", "admin@test.com", previous_teacher_email="ANA@test.com")
    assert sorted(item["to"] for item in sent) == ["admin@test.com", "ana@test.com", "mina@test.com"]
