"""
Testovi za booking API — end-to-end preko HTTP endpointa.

Pokriva:
  - Uspešno kreiranje bookinga (multipart)
  - Konflikt istog profesora
  - Obe učionice zauzete
  - Klijentsko otkazivanje (validan token, istekao rok)
  - 24h pravilo otkazivanja
"""

from datetime import datetime, timedelta, timezone

from tests.booking_form import booking_multipart_data
from tests.conftest import make_booking, slot_local_iso, slot_utc


class TestCreateBooking:
    """Testira POST /public/bookings."""

    def test_successful_booking(self, client, db, teacher, subject, teacher_subject_link, availability):
        """Uspešno kreiranje bookinga — vraća 201 sa svim podacima."""
        resp = client.post(
            "/public/bookings",
            data=booking_multipart_data(
                subject_id=subject.id,
                teacher_id=teacher.id,
                start_time=slot_local_iso(9),
                duration=45,
                client_full_name="Test Klijent",
                client_email="test@test.com",
                client_category="faks",
            ),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["subject_name"] == "Matematika"
        assert data["teacher_name"] == "Prof Petar"
        assert data["duration_minutes"] == 45
        assert data["status"] == "confirmed"
        assert data["classroom_number"] == 1
        assert data["delivery_mode"] == "in_person"
        assert data["session_type"] == "individual"
        assert data["client_cancel_token"] is not None
        assert data.get("attachments") == []

    def test_booking_90min(self, client, db, teacher, subject, teacher_subject_link, availability):
        """Kreiranje 90-minutnog časa."""
        resp = client.post(
            "/public/bookings",
            data=booking_multipart_data(
                subject_id=subject.id,
                teacher_id=teacher.id,
                start_time=slot_local_iso(9),
                duration=90,
                client_full_name="Ana A.",
                client_email="ana@test.com",
                client_category="srednja",
            ),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["duration_minutes"] == 90
        assert datetime.fromisoformat(data["end_time"]) == slot_utc(10, 30)

    def test_teacher_conflict_returns_409(self, client, db, teacher, subject, teacher_subject_link, availability):
        """Dva bookinga istog profesora u isto vreme → 409."""
        make_booking(
            db, teacher, subject,
            start_time=slot_utc(9),
            duration=45, classroom=1,
        )
        db.commit()

        resp = client.post(
            "/public/bookings",
            data=booking_multipart_data(
                subject_id=subject.id,
                teacher_id=teacher.id,
                start_time=slot_local_iso(9),
                duration=45,
                client_full_name="Marko",
                client_email="marko@test.com",
                client_category="faks",
            ),
        )
        assert resp.status_code == 409

    def test_both_classrooms_full_returns_409(self, client, db, teacher, teacher2, subject, subject2, teacher_subject_link, availability):
        """Obe učionice zauzete → 409."""
        from app.models.teacher import Teacher as T
        from app.models.teacher_subject import TeacherSubject as TS
        t3 = T(full_name="Prof Tri", email="tri@test.com", password_hash="x", is_active=True, is_approved=True)
        db.add(t3)
        db.flush()
        db.add(TS(teacher_id=t3.id, subject_id=subject.id))
        db.flush()

        make_booking(db, teacher2, subject, slot_utc(9), 45, classroom=1)
        make_booking(db, t3, subject2, slot_utc(9), 45, classroom=2)
        db.commit()

        resp = client.post(
            "/public/bookings",
            data=booking_multipart_data(
                subject_id=subject.id,
                teacher_id=teacher.id,
                start_time=slot_local_iso(9),
                duration=45,
                client_full_name="Luka",
                client_email="luka@test.com",
                client_category="osnovna",
            ),
        )
        assert resp.status_code == 409

    def test_outside_availability_returns_400(self, client, db, teacher, subject, teacher_subject_link, availability):
        """Booking van raspoloživosti → 400."""
        resp = client.post(
            "/public/bookings",
            data=booking_multipart_data(
                subject_id=subject.id,
                teacher_id=teacher.id,
                start_time=slot_local_iso(18),
                duration=45,
                client_full_name="Jovana",
                client_email="jovana@test.com",
                client_category="srednja",
            ),
        )
        assert resp.status_code == 400

    def test_invalid_duration_returns_422(self, client, db, teacher, subject, teacher_subject_link, availability):
        """Nevalidno trajanje → 422."""
        resp = client.post(
            "/public/bookings",
            data=booking_multipart_data(
                subject_id=subject.id,
                teacher_id=teacher.id,
                start_time=slot_local_iso(9),
                duration=30,
                client_full_name="Petar",
                client_email="petar@test.com",
                client_category="faks",
            ),
        )
        assert resp.status_code == 422

    def test_assigns_classroom_1_then_2(self, client, db, teacher, teacher2, subject, teacher_subject_link, availability):
        """Učionica 1 zauzeta → dodeljuje se učionica 2."""
        make_booking(db, teacher2, subject, slot_utc(9), 45, classroom=1)
        db.commit()

        resp = client.post(
            "/public/bookings",
            data=booking_multipart_data(
                subject_id=subject.id,
                teacher_id=teacher.id,
                start_time=slot_local_iso(9),
                duration=45,
                client_full_name="Test",
                client_email="t@t.com",
                client_category="drugo",
            ),
        )
        assert resp.status_code == 201
        assert resp.json()["classroom_number"] == 2

    def test_online_booking_when_classrooms_full_returns_201(self, client, db, teacher, teacher2, subject, subject2, teacher_subject_link, availability):
        """Online čas ne troši fizičku učionicu — može i kad su obe učionice zauzete uživo."""
        from app.models.teacher import Teacher as T
        from app.models.teacher_subject import TeacherSubject as TS

        t3 = T(full_name="Prof Tri", email="tri@test.com", password_hash="x", is_active=True, is_approved=True)
        db.add(t3)
        db.flush()
        db.add(TS(teacher_id=t3.id, subject_id=subject.id))
        db.flush()

        make_booking(db, teacher2, subject, slot_utc(9), 45, classroom=1)
        make_booking(db, t3, subject2, slot_utc(9), 45, classroom=2)
        db.commit()

        resp = client.post(
            "/public/bookings",
            data=booking_multipart_data(
                subject_id=subject.id,
                teacher_id=teacher.id,
                start_time=slot_local_iso(9),
                duration=45,
                client_full_name="Online User",
                client_email="on@test.com",
                client_category="faks",
                delivery_mode="online",
                session_type="group",
            ),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["classroom_number"] == 0
        assert data["delivery_mode"] == "online"
        assert data["session_type"] == "group"

    def test_booking_with_pdf_attachment(self, client, db, teacher, subject, teacher_subject_link, availability):
        """Opcioni PDF prilog — čuva ime fajla u odgovoru."""
        pdf_bytes = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
        resp = client.post(
            "/public/bookings",
            data=booking_multipart_data(
                subject_id=subject.id,
                teacher_id=teacher.id,
                start_time=slot_local_iso(11),
                duration=45,
                client_full_name="Sa Prilogom",
                client_email="prilog@test.com",
                client_category="faks",
                client_note="Evo materijala",
            ),
            files=[("attachments", ("materijal.pdf", pdf_bytes, "application/pdf"))],
        )
        assert resp.status_code == 201
        data = resp.json()
        assert len(data["attachments"]) == 1
        assert data["attachments"][0]["original_name"] == "materijal.pdf"
        assert data["client_note"] == "Evo materijala"


class TestCancelBooking:
    """Testira POST /public/bookings/cancel."""

    def test_valid_cancel(self, client, db, teacher, subject, teacher_subject_link, availability):
        """Uspešno otkazivanje sa validnim tokenom (>24h do časa)."""
        future = datetime.now(timezone.utc) + timedelta(hours=48)
        b = make_booking(
            db, teacher, subject,
            start_time=future,
            duration=45,
        )
        token = b.client_cancel_token
        db.commit()

        resp = client.post("/public/bookings/cancel", json={
            "token": token,
            "reason": "Ne mogu doći",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "cancelled"
        assert data["booking_id"] == b.id

    def test_invalid_token_returns_404(self, client):
        """Nevalidan token → 404."""
        resp = client.post("/public/bookings/cancel", json={
            "token": "totally-fake-token-1234",
        })
        assert resp.status_code == 404

    def test_already_cancelled_returns_400(self, client, db, teacher, subject, teacher_subject_link, availability):
        """Ponovo otkazivanje već otkazanog → 400."""
        b = make_booking(
            db, teacher, subject,
            start_time=slot_utc(9),
            duration=45, status="cancelled",
        )
        token = b.client_cancel_token
        db.commit()

        resp = client.post("/public/bookings/cancel", json={"token": token})
        assert resp.status_code == 400

    def test_late_cancel_returns_400(self, client, db, teacher, subject, teacher_subject_link, availability):
        """Otkazivanje manje od 24h pre časa → 400."""
        soon = datetime.now(timezone.utc) + timedelta(hours=2)
        b = make_booking(db, teacher, subject, start_time=soon, duration=45)
        token = b.client_cancel_token
        db.commit()

        resp = client.post("/public/bookings/cancel", json={"token": token})
        assert resp.status_code == 400
        assert "24" in resp.json()["detail"]
