"""
Testovi za učeničke naloge: registracija, prijava, profil i časovi vezani za nalog.
"""

from tests.booking_form import booking_multipart_data
from tests.conftest import slot_local_iso


def register(client, email="ucenik@test.com", password="lozinka123", full_name="Ana Učenik", category="srednja"):
    return client.post("/auth/student/register", json={"full_name": full_name, "email": email, "password": password, "category": category})


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def book(client, subject, teacher, hour, headers=None, email="ucenik@test.com"):
    return client.post(
        "/public/bookings",
        data=booking_multipart_data(
            subject_id=subject.id, teacher_id=teacher.id, start_time=slot_local_iso(hour), duration=45,
            client_full_name="Ana Učenik", client_email=email, client_category="srednja",
        ),
        headers=headers or {},
    )


class TestStudentAuth:
    def test_register_returns_token_and_profile(self, client):
        resp = register(client)
        assert resp.status_code == 201
        token = resp.json()["access_token"]
        me = client.get("/student/me", headers=auth(token))
        assert me.status_code == 200
        assert me.json() == {"id": me.json()["id"], "full_name": "Ana Učenik", "email": "ucenik@test.com", "category": "srednja"}

    def test_duplicate_email_is_rejected_case_insensitively(self, client):
        assert register(client).status_code == 201
        resp = register(client, email="UCENIK@test.com")
        assert resp.status_code == 409

    def test_short_password_is_rejected(self, client):
        assert register(client, password="kratka").status_code == 422

    def test_login_with_correct_and_wrong_password(self, client):
        register(client)
        ok = client.post("/auth/student/login", json={"email": "Ucenik@Test.com", "password": "lozinka123"})
        assert ok.status_code == 200
        bad = client.post("/auth/student/login", json={"email": "ucenik@test.com", "password": "pogresna"})
        assert bad.status_code == 401

    def test_teacher_token_cannot_open_student_routes(self, client, teacher):
        login = client.post("/auth/teacher/login", json={"email": teacher.email, "password": "test123"})
        assert login.status_code == 200
        assert client.get("/student/me", headers=auth(login.json()["access_token"])).status_code == 401
        assert client.get("/student/me").status_code == 401


class TestStudentBookings:
    def test_booking_made_while_logged_in_is_linked_to_the_account(self, client, teacher, subject, teacher_subject_link, availability):
        token = register(client).json()["access_token"]
        created = book(client, subject, teacher, 9, headers=auth(token))
        assert created.status_code == 201

        listing = client.get("/student/bookings", headers=auth(token))
        assert listing.status_code == 200
        items = listing.json()["items"]
        assert [item["id"] for item in items] == [created.json()["id"]]
        assert items[0]["client_cancel_token"]

        upcoming = client.get("/student/bookings?upcoming_only=true", headers=auth(token))
        assert upcoming.json()["total"] == 1

    def test_guest_bookings_with_the_same_email_are_not_exposed(self, client, teacher, subject, teacher_subject_link, availability):
        """Registracija na tuđu adresu ne otkriva časove zakazane bez prijave."""
        assert book(client, subject, teacher, 9).status_code == 201
        token = register(client).json()["access_token"]
        assert client.get("/student/bookings", headers=auth(token)).json()["total"] == 0

    def test_students_only_see_their_own_bookings(self, client, teacher, subject, teacher_subject_link, availability):
        first = register(client).json()["access_token"]
        second = register(client, email="drugi@test.com", full_name="Drugi Učenik").json()["access_token"]
        assert book(client, subject, teacher, 9, headers=auth(first)).status_code == 201
        assert client.get("/student/bookings", headers=auth(second)).json()["total"] == 0

    def test_invalid_token_still_allows_guest_booking(self, client, teacher, subject, teacher_subject_link, availability):
        resp = book(client, subject, teacher, 9, headers={"Authorization": "Bearer nevazeci"})
        assert resp.status_code == 201
