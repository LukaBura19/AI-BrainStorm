"""Regresioni testovi za popravke pronađene tokom kompletnog E2E audita."""

from datetime import datetime, timedelta, timezone

from app.services import email_service
from app.services.attachment_service import _sanitize_original_name
from app.services.availability_service import get_available_slots
from app.models.teacher_availability import TeacherAvailability
from app.utils.datetime_utils import local_today
from tests.booking_form import booking_multipart_data
from tests.conftest import TEST_DATE, make_booking, slot_local_iso, slot_utc


def _admin_token(client, admin_user):
    response = client.post(
        "/auth/admin/login",
        json={"email": "admin@test.com", "password": "admin123"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_past_slot_date_is_rejected(client, teacher):
    response = client.get(
        "/public/available-slots",
        params={
            "teacher_id": teacher.id,
            "date": (local_today() - timedelta(days=1)).isoformat(),
            "duration": 45,
        },
    )
    assert response.status_code == 400
    assert "prošao" in response.json()["detail"]


def test_cancel_link_preview_contains_only_safe_booking_details(client, db, teacher, subject):
    booking = make_booking(
        db,
        teacher,
        subject,
        start_time=datetime.now(timezone.utc) + timedelta(hours=72),
    )
    db.commit()

    response = client.get(f"/public/bookings/cancel/{booking.client_cancel_token}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["booking_id"] == booking.id
    assert payload["can_cancel"] is True
    assert "client_email" not in payload
    assert "client_cancel_token" not in payload


def test_spoofed_pdf_attachment_is_rejected(client, teacher, subject, teacher_subject_link, availability):
    response = client.post(
        "/public/bookings",
        data=booking_multipart_data(
            subject_id=subject.id,
            teacher_id=teacher.id,
            start_time=slot_local_iso(12),
            duration=45,
            client_full_name="Bezbednosni test",
            client_email="security@test.com",
            client_category="drugo",
        ),
        files=[("attachments", ("lazni.pdf", b"ovo nije pdf", "application/pdf"))],
    )
    assert response.status_code == 400
    assert "Sadržaj priloga" in response.json()["detail"]


def test_admin_creates_immediately_bookable_teacher_with_subjects(client, admin_user, subject):
    token = _admin_token(client, admin_user)
    response = client.post(
        "/admin/teachers",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "full_name": "Novi Profesor",
            "email": "novi-profesor@test.com",
            "password": "sigurna-lozinka",
            "is_approved": True,
            "subject_ids": [subject.id],
        },
    )
    assert response.status_code == 201
    assert response.json()["subjects"] == [{"id": subject.id, "name": subject.name}]

    public = client.get(f"/public/teachers?subject_id={subject.id}")
    assert any(item["full_name"] == "Novi Profesor" for item in public.json()["items"])


def test_login_email_is_case_insensitive(client, admin_user, teacher):
    admin_login = client.post(
        "/auth/admin/login",
        json={"email": "ADMIN@TEST.COM", "password": "admin123"},
    )
    teacher_login = client.post(
        "/auth/teacher/login",
        json={"email": "PETAR@TEST.COM", "password": "test123"},
    )
    assert admin_login.status_code == 200
    assert teacher_login.status_code == 200


def test_download_filename_strips_paths_and_header_breaks():
    sanitized = _sanitize_original_name("C:\\fake\\folder\\zadaci\r\nX-Evil: yes.pdf")
    assert sanitized == "zadaci X-Evil yes.pdf"
    assert "\r" not in sanitized and "\n" not in sanitized


def test_overlapping_legacy_availability_does_not_duplicate_public_slots(
    db, teacher, availability
):
    db.add(
        TeacherAvailability(
            teacher_id=teacher.id,
            start_time=slot_utc(9),
            end_time=slot_utc(12),
            is_available=True,
        )
    )
    db.flush()

    slots = get_available_slots(db, teacher.id, TEST_DATE, 60, delivery_mode="online")
    starts = [slot["start_time"] for slot in slots]
    assert len(starts) == len(set(starts))


def test_upcoming_filter_hides_past_teacher_bookings(client, db, teacher, subject):
    past = make_booking(db, teacher, subject, datetime.now(timezone.utc) - timedelta(days=2))
    future = make_booking(db, teacher, subject, datetime.now(timezone.utc) + timedelta(days=2))
    db.commit()
    login = client.post(
        "/auth/teacher/login",
        json={"email": "petar@test.com", "password": "test123"},
    )
    token = login.json()["access_token"]
    response = client.get(
        "/teacher/bookings?status=confirmed&upcoming_only=true",
        headers={"Authorization": f"Bearer {token}"},
    )
    ids = [item["id"] for item in response.json()["items"]]
    assert future.id in ids
    assert past.id not in ids


def test_admin_cannot_reassign_booking_into_the_past(client, db, admin_user, teacher, subject):
    booking = make_booking(
        db,
        teacher,
        subject,
        datetime.now(timezone.utc) + timedelta(days=2),
    )
    db.commit()
    token = _admin_token(client, admin_user)

    response = client.patch(
        f"/admin/bookings/{booking.id}/reassign",
        headers={"Authorization": f"Bearer {token}"},
        json={"start_time": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()},
    )

    assert response.status_code == 400
    assert "prošao" in response.json()["detail"]


def test_classroom_schedule_does_not_count_online_lessons(
    client, db, admin_user, teacher, subject
):
    in_person = make_booking(db, teacher, subject, slot_utc(9), classroom=1)
    online = make_booking(
        db,
        teacher,
        subject,
        slot_utc(11),
        delivery_mode="online",
    )
    db.commit()
    token = _admin_token(client, admin_user)

    response = client.get(
        "/admin/classrooms/schedule",
        params={"date": TEST_DATE.isoformat()},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_bookings"] == 1
    scheduled_ids = {
        slot["booking_id"]
        for classroom in payload["classrooms"]
        for slot in classroom["slots"]
    }
    assert in_person.id in scheduled_ids
    assert online.id not in scheduled_ids


def test_email_template_uses_belgrade_time_and_escapes_user_content():
    data = {
        "subject_name": "Matematika",
        "teacher_name": "Luka Bura",
        "client_full_name": "<script>alert(1)</script>",
        "client_email": "client@test.com",
        "client_category": "srednja",
        "client_note": "<img src=x onerror=alert(1)>",
        "start_time": slot_utc(9),
        "end_time": slot_utc(10),
        "duration_minutes": 60,
        "classroom_number": 1,
        "delivery_mode": "in_person",
        "session_type": "individual",
    }
    body = email_service._build_confirmation_html(data, role="client", cancel_url="http://localhost/cancel/token")
    assert "09:00" in body
    assert "<script>alert(1)</script>" not in body
    assert "<img src=x onerror=alert(1)>" not in body
    assert "&lt;script&gt;" in body


def test_email_delivery_reports_partial_failure(monkeypatch):
    monkeypatch.setattr(email_service.settings, "MAIL_SERVER", "smtp.example.com")
    monkeypatch.setattr(email_service.settings, "MAIL_DELIVERY_MODE", "smtp")
    outcomes = iter([True, False, True])
    monkeypatch.setattr(email_service, "send_email", lambda **_kwargs: next(outcomes))
    result = email_service.send_booking_confirmation(
        booking_data={
            "subject_name": "Matematika",
            "client_full_name": "Klijent",
            "teacher_name": "Profesor",
        },
        client_email="client@test.com",
        teacher_email="teacher@test.com",
        admin_email="admin@test.com",
    )
    assert result == {"sent": 2, "failed": 1, "total": 3, "status": "partial"}
