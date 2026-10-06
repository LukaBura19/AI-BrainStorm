"""Regressions for real SMTP delivery versus local-only capture."""

import smtplib
from datetime import datetime, timedelta, timezone
from email import message_from_string
from unittest.mock import MagicMock

import pytest
from pydantic import ValidationError

from app.core.config import Settings, settings
from app.services import email_service
from tests.conftest import make_booking


@pytest.fixture
def smtp_transport(monkeypatch):
    # Only the external SMTP connection is replaced; MIME, delivery and counts are real.
    monkeypatch.setattr(settings, "MAIL_ENABLED", True)
    monkeypatch.setattr(settings, "MAIL_SERVER", "smtp.example.com")
    monkeypatch.setattr(settings, "MAIL_DELIVERY_MODE", "smtp")
    monkeypatch.setattr(settings, "MAIL_PORT", 587)
    monkeypatch.setattr(settings, "MAIL_USERNAME", "sender@example.com")
    monkeypatch.setattr(settings, "MAIL_PASSWORD", "test-smtp-password")
    monkeypatch.setattr(settings, "MAIL_FROM", "sender@example.com")
    monkeypatch.setattr(settings, "MAIL_TLS", True)
    monkeypatch.setattr(settings, "MAIL_SSL", False)
    connection = MagicMock()
    server = connection.return_value.__enter__.return_value
    server.sendmail.return_value = {}
    server.noop.return_value = (250, b"OK")
    monkeypatch.setattr(email_service.smtplib, "SMTP", connection)
    monkeypatch.setattr(email_service.smtplib, "SMTP_SSL", connection)
    return connection, server


def confirmation():
    return email_service.send_booking_confirmation(
        booking_data={"subject_name": "Matematika", "client_full_name": "Klijent", "teacher_name": "Profesor"},
        client_email="client@example.com",
        teacher_email="teacher@example.com",
        admin_email="admin@example.com",
        cancel_url="https://example.com/cancel/test-token",
    )


def test_mailhog_acceptance_does_not_report_real_delivery(smtp_transport, monkeypatch):
    monkeypatch.setattr(settings, "MAIL_SERVER", "mailhog")
    result = confirmation()
    assert result == {"sent": 0, "captured": 3, "failed": 0, "total": 3, "status": "captured"}


def test_external_smtp_acceptance_sends_personalized_messages_after_tls(smtp_transport):
    connection, server = smtp_transport
    result = confirmation()
    assert result["status"] == "sent"
    assert result["sent"] == 3
    recipients = {call.args[1][0] for call in server.sendmail.call_args_list}
    assert recipients == {"client@example.com", "teacher@example.com", "admin@example.com"}
    message = message_from_string(server.sendmail.call_args_list[0].args[2])
    assert message["From"] == "sender@example.com"
    assert message.is_multipart()
    assert {part.get_content_type() for part in message.get_payload()} == {"text/plain", "text/html"}
    method_names = [call[0] for call in server.method_calls]
    assert method_names.index("starttls") < method_names.index("login") < method_names.index("sendmail")
    assert connection.call_args.args == ("smtp.example.com", 587)


def test_refused_recipient_is_not_counted_as_sent(smtp_transport):
    _, server = smtp_transport
    server.sendmail.return_value = {"rejected@example.com": (550, b"Mailbox unavailable")}
    assert email_service.send_email(
        to=["accepted@example.com", "rejected@example.com"], subject="Test", html_body="<p>Test</p>"
    ) is False


def test_authentication_failure_does_not_report_sent(smtp_transport):
    _, server = smtp_transport
    server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"Invalid credentials")
    result = confirmation()
    assert result["status"] == "failed"
    assert result["sent"] == 0
    assert result["failed"] == 3
    server.sendmail.assert_not_called()


def test_server_closing_connection_during_login_counts_as_rejected_login(smtp_transport, capsys):
    # Gmail answers a wrong password by closing the connection; that must read as a failed login.
    from app.check_email import main

    _, server = smtp_transport
    server.login.side_effect = smtplib.SMTPServerDisconnected("Connection unexpectedly closed")
    assert confirmation()["status"] == "failed"
    server.sendmail.assert_not_called()
    assert main([]) == 1
    assert "prijava je odbijena (kod 535)" in capsys.readouterr().out


def test_gmail_login_failure_points_to_app_password(smtp_transport, monkeypatch, capsys):
    from app.check_email import main

    monkeypatch.setattr(settings, "MAIL_SERVER", "smtp.gmail.com")
    smtp_transport[1].login.side_effect = smtplib.SMTPAuthenticationError(535, b"Username and Password not accepted")
    assert main([]) == 1
    output = capsys.readouterr().out
    assert "App Password" in output
    assert "test-smtp-password" not in output


@pytest.mark.parametrize("server, expected", [("smtp.gmail.com", "abcdefghijklmnop"), ("smtp.example.com", "abcd efgh ijkl mnop")])
def test_gmail_app_password_spaces_are_ignored(server, expected):
    configured = Settings(_env_file=None, MAIL_SERVER=server, MAIL_USERNAME="sender@gmail.com", MAIL_PASSWORD="abcd efgh ijkl mnop", MAIL_TLS=True, MAIL_SSL=False)
    assert configured.MAIL_PASSWORD == expected


def test_incomplete_smtp_credentials_are_rejected():
    with pytest.raises(ValidationError, match="MAIL_USERNAME.*MAIL_PASSWORD"):
        Settings(_env_file=None, MAIL_ENABLED=True, MAIL_USERNAME="sender@example.com", MAIL_PASSWORD="", MAIL_TLS=False, MAIL_SSL=False)


def test_disabled_email_allows_staging_sender_without_password(smtp_transport, monkeypatch):
    pending = Settings(
        _env_file=None,
        MAIL_ENABLED=False,
        MAIL_SERVER="smtp.gmail.com",
        MAIL_PORT=587,
        MAIL_USERNAME="sender@gmail.com",
        MAIL_PASSWORD="",
        MAIL_TLS=True,
        MAIL_SSL=False,
    )
    monkeypatch.setattr(email_service, "settings", pending)
    assert email_service.send_email(to="owner@example.com", subject="Test", html_body="<p>Test</p>") is False
    smtp_transport[0].assert_not_called()


def test_invalid_mail_settings_do_not_expose_password_in_error(monkeypatch):
    # Keep unrelated container configuration out of the error's truncated input repr.
    for name in Settings.model_fields:
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None, MAIL_PASSWORD="pw9", MAIL_USERNAME="", MAIL_ENABLED=True)
    assert "pw9" not in str(error.value)


@pytest.mark.parametrize("host, notice_sent", [("mailhog", False), ("smtp.example.com", True)])
def test_late_cancel_does_not_claim_capture_was_delivered(smtp_transport, monkeypatch, client, db, teacher, subject, host, notice_sent):
    monkeypatch.setattr(settings, "MAIL_SERVER", host)
    booking = make_booking(db, teacher, subject, start_time=datetime.now(timezone.utc) + timedelta(hours=2), duration=45)
    db.commit()
    response = client.post("/public/bookings/cancel", json={"token": booking.client_cancel_token})
    assert response.status_code == 400
    assert ("Obaveštenje je poslato" in response.json()["detail"]) is notice_sent
    db.refresh(booking)
    assert booking.status == "confirmed"


def test_diagnostic_distinguishes_capture_from_real_smtp(smtp_transport, monkeypatch, capsys):
    from app.check_email import main

    monkeypatch.setattr(settings, "MAIL_SERVER", "mailhog")
    assert main([]) == 2
    output = capsys.readouterr().out
    assert "MailHog" in output
    assert "test-smtp-password" not in output
    smtp_transport[1].sendmail.assert_not_called()


def test_diagnostic_checks_external_auth_without_sending_mail(smtp_transport):
    from app.check_email import main

    assert main([]) == 0
    smtp_transport[1].sendmail.assert_not_called()


def test_diagnostic_fails_for_invalid_credentials_without_exposing_secret(smtp_transport, capsys):
    from app.check_email import main

    smtp_transport[1].login.side_effect = smtplib.SMTPAuthenticationError(535, b"test-smtp-password")
    assert main([]) == 1
    output = capsys.readouterr().out
    assert "535" in output
    assert "test-smtp-password" not in output


def test_diagnostic_send_fails_when_smtp_rejects_message(smtp_transport):
    from app.check_email import main

    smtp_transport[1].sendmail.side_effect = smtplib.SMTPDataError(550, b"Sender not verified")
    assert main(["--to", "owner@example.com"]) == 1
