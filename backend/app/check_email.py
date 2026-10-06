"""Run with `python -m app.check_email [--to owner@example.com]`."""

import argparse
import smtplib

from pydantic import EmailStr, TypeAdapter, ValidationError

from app.core.config import settings
from app.services.email_service import send_email, smtp_connection


def email_address(value: str) -> str:
    try:
        return str(TypeAdapter(EmailStr).validate_python(value))
    except ValidationError:
        raise argparse.ArgumentTypeError("Unesite ispravnu email adresu.") from None


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Provera BrainStorm SMTP veze i slanja emaila.")
    parser.add_argument("--to", type=email_address, help="Pošalji jednu test poruku na navedenu adresu.")
    args = parser.parse_args(argv)

    print(f"SMTP: {settings.MAIL_SERVER}:{settings.MAIL_PORT}; pošiljalac: {settings.MAIL_FROM}")
    if not settings.MAIL_ENABLED:
        print("Slanje emaila je isključeno (MAIL_ENABLED=false).")
        return 1

    if settings.mail_is_capture:
        print("Test režim (MailHog/Mailpit ili MAIL_DELIVERY_MODE=capture): poruke ne stižu u stvarna sandučeta.")

    try:
        with smtp_connection() as server:
            code, response = server.noop()
            if code != 250:
                raise smtplib.SMTPResponseException(code, response)
    except smtplib.SMTPAuthenticationError as exc:
        print(f"SMTP prijava je odbijena (kod {exc.smtp_code}). Proverite korisničko ime i SMTP lozinku.")
        if settings.uses_gmail:
            print("Gmail prihvata samo lozinku za aplikacije (App Password, 16 slova), ne običnu lozinku naloga.")
            print("Napravite je na https://myaccount.google.com/apppasswords (potrebna je verifikacija u 2 koraka).")
        return 1
    except Exception as exc:
        print(f"SMTP provera nije uspela: {type(exc).__name__}; kod={getattr(exc, 'smtp_code', 'n/a')}.")
        print("Proverite adresu servera, port i MAIL_TLS / MAIL_SSL podešavanja.")
        return 1

    if args.to:
        accepted = send_email(
            to=args.to,
            subject="BrainStorm — provera slanja emaila",
            html_body="<h1>BrainStorm</h1><p>Ovo je test podešavanja email potvrda. Nije kreirana rezervacija.</p>",
        )
        if not accepted:
            print("SMTP nije prihvatio test poruku. Proverite dozvoljenog pošiljaoca i odgovor u backend logu.")
            return 1
        if not settings.mail_is_capture:
            print("SMTP je prihvatio test poruku. Proverite prijemno sanduče i Spam; prijem još nije potvrđen.")
    else:
        print("SMTP veza i podešena prijava rade. Poruka nije poslata; za test koristite --to vasa-adresa.")

    return 2 if settings.mail_is_capture else 0


if __name__ == "__main__":
    raise SystemExit(main())
