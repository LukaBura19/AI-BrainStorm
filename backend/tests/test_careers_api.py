"""Prijave za posao: upitnik sa CV-om, email centru i pregled u admin panelu."""

from email import message_from_string

import pytest

from app.api.careers import application_limiter
from app.core.config import settings
from app.services import email_service

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


@pytest.fixture(autouse=True)
def isolated_uploads(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    application_limiter.reset()
    yield
    application_limiter.reset()


def apply(client, cv=("cv.pdf", PDF, "application/pdf"), **overrides):
    data = {"full_name": "Ana Profesor", "phone": "064 123 4567", "degree": "Master studije",
            "subjects": "Matematika, Fizika", "experience": "1 do 3 godine", "about": "Predajem dve godine."}
    data.update(overrides)
    return client.post("/public/job-applications", data=data, files={"cv": cv} if cv else None)


def admin_headers(client, admin_user):
    token = client.post("/auth/admin/login", json={"email": "admin@test.com", "password": "admin123"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_application_is_stored_and_visible_to_admin(client, admin_user):
    assert apply(client).status_code == 201
    headers = admin_headers(client, admin_user)
    listed = client.get("/admin/job-applications", headers=headers).json()
    assert listed[0]["full_name"] == "Ana Profesor" and listed[0]["cv_original_name"] == "cv.pdf"
    cv = client.get(f"/admin/job-applications/{listed[0]['id']}/cv", headers=headers)
    assert cv.status_code == 200 and cv.content == PDF


def test_admin_endpoints_need_admin(client):
    assert client.get("/admin/job-applications").status_code in (401, 403)


def test_center_gets_email_with_cv_attached(client, monkeypatch):
    sent = []

    class FakeSMTP:
        def __init__(self, *args, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *exc): return False
        def ehlo_or_helo_if_needed(self): pass
        def sendmail(self, sender, recipients, message):
            sent.append((recipients, message))
            return {}

    monkeypatch.setattr(settings, "MAIL_ENABLED", True)
    monkeypatch.setattr(settings, "MAIL_SERVER", "smtp.example.com")
    monkeypatch.setattr(settings, "MAIL_TLS", False)
    monkeypatch.setattr(settings, "MAIL_USERNAME", "")
    monkeypatch.setattr(settings, "MAIL_PASSWORD", "")
    monkeypatch.setattr(email_service.smtplib, "SMTP", FakeSMTP)
    assert apply(client).status_code == 201
    recipients, raw = sent[0]
    assert recipients == [settings.ADMIN_EMAIL]
    attachment = [part for part in message_from_string(raw).walk() if part.get_filename() == "cv.pdf"][0]
    assert attachment.get_payload(decode=True) == PDF


@pytest.mark.parametrize("cv, overrides", [
    (("cv.exe", b"MZ", "application/octet-stream"), {}),
    (("cv.pdf", b"not a pdf", "application/pdf"), {}),
    (None, {}),
    (("cv.pdf", PDF, "application/pdf"), {"email": "nije-email"}),
    (("cv.pdf", PDF, "application/pdf"), {"phone": ""}),
    (("cv.pdf", PDF, "application/pdf"), {"phone": "abc"}),
    (("cv.pdf", PDF, "application/pdf"), {"degree": "Akademik"}),
    (("cv.pdf", PDF, "application/pdf"), {"subjects": "  "}),
])
def test_invalid_applications_are_rejected(client, cv, overrides):
    assert apply(client, cv=cv, **overrides).status_code in (400, 422)


def test_too_many_applications_from_one_ip(client):
    for _ in range(5):
        assert apply(client).status_code == 201
    assert apply(client).status_code == 429
