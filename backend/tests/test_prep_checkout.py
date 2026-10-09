"""
Plaćen pristup snimcima (mala i velika matura): naplata test karticom, automatski nalog,
zaključavanje videa bez uplate i test učenik iz seed-a.
"""

import pytest

from app.core.config import settings
from app.db.seed import seed_admins, seed_students
from app.models.prep_purchase import PrepPurchase
from app.models.student import Student
from app.services import email_service, payment_service
from app.services.prep_catalog import find_lecture

EXAM_URL = "/public/prep/mala-matura"
LECTURE_URL = "/public/prep/mala-matura/matematika/procenti"
VIDEO_ID = "dQw4w9WgXcQ"
GOOD_CARD = {"number": "4242 4242 4242 4242", "exp_month": 12, "exp_year": 30, "cvc": "123", "holder_name": "ANA PROBA"}
DETAILS = {"full_name": "Ana Proba", "email": "ana.proba@test.rs", "password": "lozinka123"}


@pytest.fixture()
def video_lecture():
    """Katalog u repou još nema videe; ovaj test privremeno daje snimku 'procenti' YouTube ID."""
    lecture = find_lecture("mala-matura", "matematika", "procenti").lecture
    lecture.youtube_id = VIDEO_ID
    yield lecture
    lecture.youtube_id = None


def checkout(client, exam="mala-matura", card=GOOD_CARD, headers=None, **details):
    body = {**DETAILS, **details, "card": card}
    return client.post(f"/public/prep/{exam}/checkout", json=body, headers=headers or {})


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def register(client, email="ucenik@test.com"):
    resp = client.post("/auth/student/register", json={"full_name": "Marko Učenik", "email": email, "password": "lozinka123"})
    assert resp.status_code == 201
    return resp.json()["access_token"]


class TestLockedVideos:
    def test_video_id_is_hidden_without_purchase(self, client, video_lecture):
        exam = client.get(EXAM_URL)
        assert exam.status_code == 200
        assert exam.json()["access"] == {"price_eur": 50, "includes": exam.json()["access"]["includes"], "signed_in": False, "purchased": False}
        assert len(exam.json()["access"]["includes"]) >= 3
        card = next(l for g in exam.json()["subjects"][0]["groups"] for l in g["lectures"] if l["slug"] == "procenti")
        assert card == {**card, "has_video": True, "youtube_id": None}
        assert VIDEO_ID not in exam.text

        detail = client.get(LECTURE_URL)
        assert detail.json()["has_video"] is True
        assert detail.json()["youtube_id"] is None and detail.json()["video_url"] is None
        assert detail.json()["access"]["purchased"] is False
        assert VIDEO_ID not in detail.text

    def test_signed_in_student_without_purchase_is_still_locked(self, client, video_lecture):
        token = register(client)
        detail = client.get(LECTURE_URL, headers=auth(token)).json()
        assert detail["access"] == {**detail["access"], "signed_in": True, "purchased": False}
        assert detail["youtube_id"] is None

    def test_tasks_and_neighbours_stay_public(self, client, video_lecture):
        detail = client.get(LECTURE_URL).json()
        assert len(detail["tasks"]) == 3 and detail["next"]["slug"] == "linearne-jednacine"


class TestCheckout:
    def test_payment_creates_account_and_unlocks_videos(self, client, db, video_lecture):
        resp = checkout(client)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["account_created"] is True
        assert data["student"] == {**data["student"], "full_name": "Ana Proba", "email": "ana.proba@test.rs", "category": "osnovna"}
        assert data["purchase"] == {**data["purchase"], "exam": {"slug": "mala-matura", "name": "Mala matura"}, "amount_eur": 50, "card_brand": "Visa", "card_last4": "4242"}
        assert data["purchase"]["receipt_number"].startswith("BS-")
        headers = auth(data["access_token"])

        detail = client.get(LECTURE_URL, headers=headers).json()
        assert detail["youtube_id"] == VIDEO_ID and detail["access"]["purchased"] is True
        exam = client.get(EXAM_URL, headers=headers).json()
        assert exam["access"]["purchased"] is True
        assert VIDEO_ID in client.get(EXAM_URL, headers=headers).text

        # Druga priprema ostaje zaključana, a panel pokazuje šta je plaćeno.
        assert client.get("/public/prep/velika-matura", headers=headers).json()["access"]["purchased"] is False
        prep = client.get("/student/prep", headers=headers).json()["items"]
        assert [(item["slug"], item["purchased"]) for item in prep] == [("mala-matura", True), ("velika-matura", False)]
        assert prep[0]["purchase"]["receipt_number"] == data["purchase"]["receipt_number"]
        assert prep[0]["lecture_count"] == 12 and prep[0]["video_count"] == 1
        assert prep[1]["purchase"] is None

        # Nalog radi sa lozinkom iz kupovine.
        login = client.post("/auth/student/login", json={"email": "ANA.proba@test.rs", "password": "lozinka123"})
        assert login.status_code == 200
        assert db.query(PrepPurchase).count() == 1

    @pytest.mark.parametrize("card, fragment", [
        ({**GOOD_CARD, "number": "4000 0000 0000 0002"}, "Banka je odbila"),
        ({**GOOD_CARD, "number": "4111 1111 1111 1111"}, "4242 4242 4242 4242"),
        ({**GOOD_CARD, "number": "4242 4242 4242 4243"}, "nije ispravan"),
        ({**GOOD_CARD, "exp_year": 20}, "istekla"),
        ({**GOOD_CARD, "cvc": "12a"}, "CVC"),
    ])
    def test_failed_payment_creates_nothing(self, client, db, card, fragment):
        resp = checkout(client, card=card)
        assert resp.status_code == 402, resp.text
        assert resp.json()["detail"]["code"] == "card_declined"
        assert fragment in resp.json()["detail"]["message"]
        assert db.query(Student).filter(Student.email == "ana.proba@test.rs").count() == 0
        assert db.query(PrepPurchase).count() == 0

    def test_existing_email_must_sign_in_first(self, client):
        register(client, email="ana.proba@test.rs")
        resp = checkout(client)
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "account_exists"

    def test_new_account_needs_name_email_and_password(self, client):
        assert checkout(client, password="kratka").json()["detail"]["code"] == "weak_password"
        assert checkout(client, password=None).status_code == 422
        assert checkout(client, full_name="A").json()["detail"]["code"] == "missing_details"
        assert checkout(client, email=None).json()["detail"]["code"] == "missing_details"

    def test_signed_in_student_pays_without_details(self, client, db):
        token = register(client)
        resp = client.post("/public/prep/velika-matura/checkout", json={"card": GOOD_CARD}, headers=auth(token))
        assert resp.status_code == 201, resp.text
        assert resp.json()["account_created"] is False
        assert resp.json()["student"]["email"] == "ucenik@test.com"
        assert resp.json()["purchase"]["exam"]["slug"] == "velika-matura"

        again = client.post("/public/prep/velika-matura/checkout", json={"card": GOOD_CARD}, headers=auth(token))
        assert again.status_code == 409
        assert again.json()["detail"]["code"] == "already_purchased"
        assert db.query(PrepPurchase).count() == 1

    def test_students_do_not_share_access(self, client, video_lecture):
        checkout(client)
        other = register(client, email="drugi@test.com")
        assert client.get(LECTURE_URL, headers=auth(other)).json()["youtube_id"] is None

    def test_unknown_exam_is_404(self, client):
        assert checkout(client, exam="nepostojeca").status_code == 404

    def test_receipt_email(self, client, monkeypatch):
        sent = []
        monkeypatch.setattr(email_service, "send_email", lambda **kwargs: sent.append(kwargs) or True)
        resp = checkout(client)
        assert resp.status_code == 201
        assert len(sent) == 1 and sent[0]["to"] == "ana.proba@test.rs"
        assert resp.json()["purchase"]["receipt_number"] in sent[0]["subject"]
        assert "Mala matura" in sent[0]["subject"]
        body = sent[0]["html_body"]
        assert "50 €" in body and "Visa •••• 4242" in body and "/mala-matura" in body and "/ucenik/prijava" in body

    def test_email_failure_does_not_undo_purchase(self, client, db, monkeypatch):
        def explode(**kwargs):
            raise RuntimeError("smtp down")
        monkeypatch.setattr(email_service, "send_prep_purchase_receipt", explode)
        assert checkout(client).status_code == 201
        assert db.query(PrepPurchase).count() == 1


class TestSeedStudents:
    def test_test_account_has_both_preps_and_is_idempotent(self, client, db, capsys):
        seed_students(db)
        seed_students(db)
        assert db.query(Student).filter(Student.email == "matura@brainstorm.com").count() == 1
        login = client.post("/auth/student/login", json={"email": "matura@brainstorm.com", "password": "matura123"})
        assert login.status_code == 200
        items = client.get("/student/prep", headers=auth(login.json()["access_token"])).json()["items"]
        assert [(item["slug"], item["purchased"]) for item in items] == [("mala-matura", True), ("velika-matura", True)]
        assert db.query(PrepPurchase).count() == 2

    def test_seed_password_replaces_public_test_passwords(self, client, db, monkeypatch):
        """Na javnom serveru test lozinke iz repoa ne smeju da otvore admin panel."""
        monkeypatch.setattr(settings, "SEED_PASSWORD", "serverska-lozinka-za-seed")
        seed_admins(db)
        seed_students(db)
        admin = {"email": "lukabura89@gmail.com", "password": "serverska-lozinka-za-seed"}
        assert client.post("/auth/admin/login", json=admin).status_code == 200
        assert client.post("/auth/admin/login", json={**admin, "password": "profesor123"}).status_code == 401
        student = {"email": "matura@brainstorm.com", "password": "serverska-lozinka-za-seed"}
        assert client.post("/auth/student/login", json=student).status_code == 200


class TestPaymentService:
    def test_luhn_and_brands(self):
        assert payment_service.luhn_ok("4242424242424242") and not payment_service.luhn_ok("4242424242424243")
        assert payment_service.detect_brand("4242424242424242") == "Visa"
        assert payment_service.detect_brand("5555555555554444") == "Mastercard"
        assert payment_service.detect_brand("2221000000000009") == "Mastercard"
        assert payment_service.detect_brand("378282246310005") == "Kartica"

    def test_charge_accepts_test_cards_and_two_digit_years(self):
        charge = payment_service.charge(number="5555 5555 5555 4444", exp_month=1, exp_year=31, cvc="1234", holder_name="X Y", amount_eur=50)
        assert (charge.brand, charge.last4) == ("Mastercard", "4444") and charge.transaction_id.startswith("test_")
        with pytest.raises(payment_service.CardError):
            payment_service.charge(number="4242424242424242", exp_month=13, exp_year=31, cvc="123", holder_name="X", amount_eur=50)
        with pytest.raises(payment_service.CardError):
            payment_service.charge(number="4242424242424242", exp_month=1, exp_year=31, cvc="123", holder_name="  ", amount_eur=50)


class TestConcurrentCheckout:
    """
    Dupli klik ili dva taba: drugi upis udari u jedinstveno ograničenje i dobija 409, ne 500.
    Ruta tada radi rollback, a test sesija deli spoljnu transakciju, pa se proverava samo odgovor.
    """

    def test_second_new_account_with_same_email_is_conflict(self, client, db, monkeypatch):
        assert checkout(client).status_code == 201
        real_query = db.query
        hidden = {"done": False}

        def query_missing_new_account(*entities, **kwargs):
            # Prva provera emaila „ne vidi“ nalog, kao kad drugi zahtev stigne pre commita prvog.
            query = real_query(*entities, **kwargs)
            if entities and entities[0] is Student and not hidden["done"]:
                hidden["done"] = True
                return query.filter(Student.id == -1)
            return query

        monkeypatch.setattr(db, "query", query_missing_new_account)
        resp = checkout(client)
        assert resp.status_code == 409, resp.text
        assert resp.json()["detail"]["code"] == "account_exists"

    def test_second_purchase_for_same_student_is_conflict(self, client, monkeypatch):
        from app.api import prep as prep_api

        token = register(client)
        assert client.post("/public/prep/velika-matura/checkout", json={"card": GOOD_CARD}, headers=auth(token)).status_code == 201
        # Drugi zahtev ne vidi prvu kupovinu (učitao je nalog pre njenog commita), pa stiže do upisa.
        monkeypatch.setattr(prep_api, "purchased_exams", lambda student: set())
        resp = client.post("/public/prep/velika-matura/checkout", json={"card": GOOD_CARD}, headers=auth(token))
        assert resp.status_code == 409, resp.text
        assert resp.json()["detail"]["code"] == "already_purchased"
