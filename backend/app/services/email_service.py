"""
Email servis — apstrakcija za slanje emailova.

Koristi standardni smtplib (Python built-in) za komunikaciju sa SMTP serverom.
Lokalno koristi MailHog (SMTP na mailhog:1025 u Dockeru; Web UI na hostu vidi docker-compose).
Za produkciju se može zameniti sa Resend, Mailgun, SES itd. kroz env promenljive.

Korišćenje:
    from app.services.email_service import send_email, send_booking_confirmation
    send_email(to="user@example.com", subject="Test", html_body="<h1>Hello</h1>")
"""

import html
import logging
import re
import smtplib
import ssl
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

from app.core.config import settings
from app.utils.datetime_utils import to_app_timezone

logger = logging.getLogger(__name__)


# =============================================
#  Mapiranja za čitljiv prikaz
# =============================================

CATEGORY_LABELS = {
    "osnovna": "Osnovna škola",
    "srednja": "Srednja škola",
    "faks": "Fakultet",
    "drugo": "Drugo",
}

CLASSROOM_LABELS = {
    0: "Online (bez fizičke učionice)",
    1: "Učionica 1 (velika)",
    2: "Učionica 2 (mala)",
}

DELIVERY_LABELS = {
    "online": "Online",
    "in_person": "Uživo",
}

SESSION_TYPE_LABELS = {
    "individual": "Individualni",
    "group": "Grupni",
}

# Srpski nazivi dana i meseci (bez locale zavisnosti)
_DAYS_SR = ["ponedeljak", "utorak", "sreda", "četvrtak", "petak", "subota", "nedelja"]
_MONTHS_SR = [
    "", "januar", "februar", "mart", "april", "maj", "jun",
    "jul", "avgust", "septembar", "oktobar", "novembar", "decembar",
]


def _format_datetime_sr(dt) -> str:
    """Formatira datetime u srpski čitljiv format: 'ponedeljak, 23. mart 2026. u 09:00'"""
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return str(dt)
    if not isinstance(dt, datetime):
        return str(dt)
    dt = to_app_timezone(dt)
    day_name = _DAYS_SR[dt.weekday()]
    month_name = _MONTHS_SR[dt.month]
    return f"{day_name}, {dt.day}. {month_name} {dt.year}. u {dt.strftime('%H:%M')}"


def _format_time(dt) -> str:
    """Formatira datetime u vreme HH:MM."""
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return str(dt)
    if not isinstance(dt, datetime):
        return str(dt)
    dt = to_app_timezone(dt)
    return dt.strftime("%H:%M")


def _format_date_sr(dt) -> str:
    """Formatira datum: 'ponedeljak, 23. mart 2026.'"""
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return str(dt)
    if not isinstance(dt, datetime):
        return str(dt)
    dt = to_app_timezone(dt)
    day_name = _DAYS_SR[dt.weekday()]
    month_name = _MONTHS_SR[dt.month]
    return f"{day_name}, {dt.day}. {month_name} {dt.year}."


# =============================================
#  Osnovna funkcija za slanje emaila
# =============================================

@contextmanager
def smtp_connection():
    """One connection path for notifications and the SMTP diagnostic command."""
    smtp_cls = smtplib.SMTP_SSL if settings.MAIL_SSL else smtplib.SMTP
    kwargs = {"timeout": settings.MAIL_TIMEOUT_SECONDS}
    if settings.MAIL_SSL:
        kwargs["context"] = ssl.create_default_context()

    with smtp_cls(settings.MAIL_SERVER, settings.MAIL_PORT, **kwargs) as server:
        server.ehlo_or_helo_if_needed()
        if settings.MAIL_TLS:
            server.starttls(context=ssl.create_default_context())
            server.ehlo_or_helo_if_needed()

        if settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
            try:
                server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            except smtplib.SMTPServerDisconnected as exc:
                # Gmail odbije lozinku i odmah zatvori vezu, pa smtplib prijavi samo "prekid veze".
                # Prekid baš tokom prijave znači da prijava nije prihvaćena.
                raise smtplib.SMTPAuthenticationError(535, b"Server je zatvorio vezu tokom prijave") from exc
        yield server


def send_email(
    to: str | List[str],
    subject: str,
    html_body: str,
    plain_body: Optional[str] = None,
) -> bool:
    """
    Šalje email koristeći SMTP server konfigurisan u env.

    Args:
        to: Email adresa primaoca (string ili lista stringova)
        subject: Naslov emaila
        html_body: HTML sadržaj emaila
        plain_body: Plain text alternativa (opciono, generiše se iz HTML-a ako nije dat)

    Returns:
        True ako je SMTP server prihvatio poruku za sve primaoce, False inače.
        Prihvatanje u lokalnom MailHog-u nije isporuka u stvarno sanduče.
    """
    if not settings.MAIL_ENABLED:
        logger.warning("Slanje emaila je isključeno konfiguracijom: subject=%r", subject)
        return False

    if isinstance(to, str):
        recipients = [to.strip()]
    else:
        recipients = [address.strip() for address in to]

    recipients = [address for address in recipients if address]
    if not recipients or any("\n" in address or "\r" in address for address in recipients):
        logger.error("Email nije poslat: lista primalaca nije validna")
        return False

    clean_subject = re.sub(r"[\r\n]+", " ", str(subject)).strip()
    clean_from = settings.MAIL_FROM.strip()
    if not clean_from or "\n" in clean_from or "\r" in clean_from:
        logger.error("Email nije poslat: MAIL_FROM nije validan")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = clean_from
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = clean_subject

    # Plain-text alternativa je važna za klijente koji blokiraju HTML.
    if not plain_body:
        plain_body = re.sub(r"<[^>]+>", " ", html_body)
        plain_body = html.unescape(re.sub(r"\s+", " ", plain_body)).strip()
    msg.attach(MIMEText(plain_body, "plain", "utf-8"))

    # HTML sadržaj
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtp_connection() as server:
            refused = server.sendmail(clean_from, recipients, msg.as_string())
        if refused:
            logger.error("SMTP je odbio %d od %d primalaca", len(refused), len(recipients))
            return False

        if settings.mail_is_capture:
            logger.warning("Email sačuvan samo na test SMTP serveru; nije poslat u stvarno sanduče")
        else:
            logger.info("SMTP je prihvatio email za %d primalaca", len(recipients))
        return True

    except Exception as e:
        # Provider replies can contain account details; log type/code, never credentials.
        logger.error("Greška pri slanju emaila: %s, SMTP kod=%s", type(e).__name__, getattr(e, "smtp_code", "n/a"))
        return False


# =============================================
#  Helper za slanje na više adresa odjednom
# =============================================

def send_emails_to_multiple(
    recipients: List[dict],
    subject_fn,
    html_fn,
) -> dict:
    """
    Šalje personalizovane emailove na više adresa.

    Args:
        recipients: Lista dict-ova sa ključem 'email' i ostalim podacima.
        subject_fn: Funkcija koja prima recipient dict i vraća subject string.
        html_fn: Funkcija koja prima recipient dict i vraća HTML body string.

    Returns:
        dict sa brojem uspešnih i neuspešnih slanja.
    """
    def deliver(recipient: dict) -> bool:
        try:
            return send_email(
                to=recipient["email"],
                subject=subject_fn(recipient),
                html_body=html_fn(recipient),
            )
        except Exception:
            logger.exception("Neočekivana greška pri pripremi emaila za %s", recipient.get("email"))
            return False

    # Svaki primalac dobija personalizovanu poruku. Paralelno slanje sprečava
    # da tri SMTP timeout-a zadrže booking zahtev tri puta duže od podešenog roka.
    workers = min(3, len(recipients))
    if workers == 0:
        outcomes = []
    else:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            outcomes = list(executor.map(deliver, recipients))
    sent = sum(outcomes)
    failed = len(outcomes) - sent

    total = sent + failed
    if settings.mail_is_capture:
        return {"sent": 0, "captured": sent, "failed": failed, "total": total, "status": "captured" if sent else "failed"}
    status_value = "sent" if failed == 0 else "failed" if sent == 0 else "partial"
    return {"sent": sent, "failed": failed, "total": total, "status": status_value}


# =============================================
#  Booking-specifične email funkcije
# =============================================

def send_booking_confirmation(
    booking_data: dict,
    client_email: str,
    teacher_email: str,
    admin_email: str,
    cancel_url: Optional[str] = None,
) -> dict:
    """
    Šalje potvrdu rezervacije klijentu, profesoru i adminu.

    Args:
        booking_data: Dict sa podacima o rezervaciji (subject_name, teacher_name,
                      start_time, end_time, duration_minutes, classroom_number,
                      client_full_name, client_email, client_category, client_note).
        client_email: Email klijenta.
        teacher_email: Email profesora.
        admin_email: Email admina.
        cancel_url: URL za otkazivanje (za klijenta).

    Returns:
        dict sa brojem poslatih i neuspelih emailova.
    """
    recipients = [
        {"email": client_email, "role": "client"},
        {"email": teacher_email, "role": "teacher"},
        {"email": admin_email, "role": "admin"},
    ]
    return send_emails_to_multiple(
        recipients,
        subject_fn=lambda recipient: (
            f"Potvrda rezervacije — {booking_data['subject_name']}"
            if recipient["role"] == "client"
            else f"Nova rezervacija — {booking_data['subject_name']}"
            if recipient["role"] == "teacher"
            else f"Nova rezervacija — {booking_data['subject_name']} ({booking_data['client_full_name']})"
        ),
        html_fn=lambda recipient: _build_confirmation_html(
            booking_data,
            role=recipient["role"],
            cancel_url=cancel_url if recipient["role"] == "client" else None,
        ),
    )


def send_cancellation_notification(
    booking_data: dict,
    client_email: str,
    teacher_email: str,
    admin_email: str,
    cancelled_by: str,
    reason: Optional[str] = None,
) -> dict:
    """
    Šalje obaveštenje o otkazivanju rezervacije.

    Args:
        booking_data: Dict sa podacima o rezervaciji.
        client_email: Email klijenta.
        teacher_email: Email profesora.
        admin_email: Email admina.
        cancelled_by: Ko je otkazao (client/teacher/admin).
        reason: Razlog otkazivanja (opciono).

    Returns:
        dict sa brojem poslatih i neuspelih emailova.
    """
    recipients = [
        {"email": client_email, "role": "client"},
        {"email": teacher_email, "role": "teacher"},
        {"email": admin_email, "role": "admin"},
    ]
    return send_emails_to_multiple(
        recipients,
        subject_fn=lambda _recipient: f"Otkazan čas — {booking_data['subject_name']}",
        html_fn=lambda recipient: _build_cancellation_html(
            booking_data,
            role=recipient["role"],
            cancelled_by=cancelled_by,
            reason=reason,
        ),
    )


def send_booking_change_notification(
    booking_data: dict,
    client_email: str,
    teacher_email: str,
    admin_email: str,
    previous_teacher_email: Optional[str] = None,
    cancel_url: Optional[str] = None,
) -> dict:
    """
    Obaveštava klijenta, profesora i admina da je čas premešten (drugi termin i/ili profesor).
    Ako je čas prebačen drugom profesoru, prethodni profesor dobija poruku da čas više nije njegov.
    """
    recipients = [
        {"email": client_email, "role": "client"},
        {"email": teacher_email, "role": "teacher"},
        {"email": admin_email, "role": "admin"},
    ]
    if previous_teacher_email and previous_teacher_email.lower() != teacher_email.lower():
        recipients.append({"email": previous_teacher_email, "role": "previous_teacher"})
    return send_emails_to_multiple(
        recipients,
        subject_fn=lambda recipient: (
            f"Čas više nije u vašem rasporedu — {booking_data['subject_name']}"
            if recipient["role"] == "previous_teacher"
            else f"Izmena termina — {booking_data['subject_name']}"
        ),
        html_fn=lambda recipient: _build_change_html(
            booking_data,
            role=recipient["role"],
            cancel_url=cancel_url if recipient["role"] == "client" else None,
        ),
    )


def send_late_cancellation_notice(
    client_email: str,
    booking_data: dict,
) -> bool:
    """
    Šalje obaveštenje klijentu da nije moguće otkazati čas
    jer je prošao rok od 24h, i da se čas mora platiti.
    """
    accepted = send_email(
        to=client_email,
        subject=f"Otkazivanje nije moguće — {booking_data['subject_name']}",
        html_body=_build_late_cancellation_html(booking_data),
    )
    return accepted and not settings.mail_is_capture


# =============================================
#  HTML templejti
# =============================================

def _base_html(content: str) -> str:
    """Wrapper za transakcione emailove, bez spoljašnjih fontova i resursa."""
    current_year = datetime.now().year
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; background-color:#f7f3ec; font-family:Arial,Helvetica,sans-serif; color:#1e2421;">
        <div style="max-width:600px; margin:0 auto; padding:32px 24px;">
            <div style="text-align:center; margin-bottom:24px;">
                <div style="color:#1f4d3a; font-size:26px; font-weight:700; letter-spacing:-0.5px;">BrainStorm</div>
                <p style="color:#7c817a; margin:4px 0 0; font-size:11px; letter-spacing:2px; text-transform:uppercase;">Edukativni centar</p>
            </div>
            <div style="background-color:#fffdf9; border-radius:20px; padding:28px; border:1px solid #e8dfd0;">
                {content}
            </div>
            <p style="color:#7c817a; font-size:12px; text-align:center; margin-top:24px;">
                Edukativni centar BrainStorm &copy; {current_year}
            </p>
        </div>
    </body>
    </html>
    """


def _booking_details_html(data: dict, role: str = "client") -> str:
    """HTML tabela sa detaljima rezervacije, prilagođena ulozi primaoca."""
    start = data.get("start_time", "N/A")
    end = data.get("end_time", "N/A")
    classroom_num = data.get("classroom_number", "N/A")
    category_raw = data.get("client_category", "N/A")

    # Lepši formati
    date_str = _format_date_sr(start)
    time_str = f"{_format_time(start)} — {_format_time(end)}"
    classroom_str = CLASSROOM_LABELS.get(classroom_num, str(classroom_num))
    category_str = CATEGORY_LABELS.get(category_raw, category_raw)
    delivery_raw = data.get("delivery_mode", "in_person")
    session_raw = data.get("session_type", "individual")
    delivery_str = DELIVERY_LABELS.get(delivery_raw, delivery_raw)
    session_str = SESSION_TYPE_LABELS.get(session_raw, session_raw)

    rows = [
        ("Predmet", data.get("subject_name", "N/A")),
        ("Profesor", data.get("teacher_name", "N/A")),
        ("Datum", date_str),
        ("Vreme", time_str),
        ("Trajanje", f"{data.get('duration_minutes', 'N/A')} minuta"),
        ("Način", delivery_str),
        ("Tip časa", session_str),
        ("Učionica", classroom_str),
    ]

    # Profesor i admin vide podatke klijenta; klijent vidi samo svoje ime
    if role in ("teacher", "admin"):
        rows.append(("Klijent", data.get("client_full_name", "N/A")))
        rows.append(("Email klijenta", data.get("client_email", "N/A")))
        rows.append(("Kategorija", category_str))
    else:
        rows.append(("Ime", data.get("client_full_name", "N/A")))
        rows.append(("Kategorija", category_str))

    if data.get("client_note"):
        rows.append(("Napomena", data["client_note"]))
    att_names = data.get("attachment_names") or []
    if att_names:
        rows.append(
            ("Prilozi", ", ".join(att_names) + " (u sistemu BrainStorm)"),
        )

    row_html = ""
    for label, value in rows:
        safe_label = html.escape(str(label))
        safe_value = html.escape(str(value))
        row_html += f"""
        <tr>
            <td style="padding:10px 4px; color:#7c817a; font-size:13px; border-bottom:1px solid #efe8dc;">{safe_label}</td>
            <td style="padding:10px 4px; color:#1e2421; font-size:13px; font-weight:700; border-bottom:1px solid #efe8dc; text-align:right;">{safe_value}</td>
        </tr>
        """

    return f"""
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        {row_html}
    </table>
    """


def _build_confirmation_html(data: dict, role: str, cancel_url: Optional[str] = None) -> str:
    """Generiše HTML potvrdu rezervacije za datu ulogu."""
    if role == "client":
        greeting = f"Poštovani/a {html.escape(str(data.get('client_full_name', '')))},"
        intro = "Vaš čas je uspešno zakazan!"
    elif role == "teacher":
        greeting = f"Poštovani/a {html.escape(str(data.get('teacher_name', '')))},"
        intro = "Imate novu rezervaciju časa."
    else:
        greeting = "Nova rezervacija je kreirana."
        intro = ""

    cancel_section = ""
    if role == "client" and cancel_url:
        safe_cancel_url = html.escape(cancel_url, quote=True)
        cancel_section = f"""
        <div style="margin-top:20px; padding:16px 18px; background-color:#efe8dc; border-radius:14px;">
            <p style="color:#1f4d3a; font-size:14px; margin:0 0 6px; font-weight:700;">Ako ne možete da dođete</p>
            <p style="color:#4f5751; font-size:13px; margin:0 0 12px;">
                Čas možete otkazati najkasnije 24 sata pre početka.
            </p>
            <a href="{safe_cancel_url}" style="display:inline-block; background-color:#1f4d3a; color:#ffffff; padding:11px 20px; border-radius:12px; text-decoration:none; font-size:14px; font-weight:700;">
                Otkaži čas
            </a>
        </div>
        """
    elif role == "client":
        cancel_section = """
        <p style="color:#7c817a; font-size:13px; margin-top:16px;">
            Čas možete otkazati najkasnije 24 sata pre početka.
            Link za otkazivanje ćete dobiti u posebnom emailu.
        </p>
        """

    content = f"""
    <h2 style="color:#1e2421; margin:0 0 4px; font-size:22px;">{greeting}</h2>
    <p style="color:#4f5751; margin:0 0 20px; font-size:15px;">{intro}</p>
    {_booking_details_html(data, role=role)}
    {cancel_section}
    """
    return _base_html(content)


def _build_cancellation_html(
    data: dict, role: str, cancelled_by: str, reason: Optional[str] = None
) -> str:
    """Generiše HTML obaveštenje o otkazivanju."""
    by_map = {"client": "klijenta", "teacher": "profesora", "admin": "admina"}
    by_label = by_map.get(cancelled_by, cancelled_by)

    reason_html = ""
    if reason:
        reason_html = f'<p style="color:#4f5751; font-size:14px;"><strong>Razlog:</strong> {html.escape(str(reason))}</p>'

    content = f"""
    <h2 style="color:#b3412e; margin:0 0 4px; font-size:20px;">Čas je otkazan</h2>
    <p style="color:#4f5751; margin:0 0 8px; font-size:15px;">Rezervacija je otkazana od strane {by_label}.</p>
    {reason_html}
    {_booking_details_html(data, role=role)}
    """
    return _base_html(content)


def _build_change_html(data: dict, role: str, cancel_url: Optional[str] = None) -> str:
    """HTML obaveštenje o premeštenom času (novi termin i/ili novi profesor)."""
    if role == "previous_teacher":
        title = "Čas je prebačen drugom profesoru"
        intro = (
            f"Administracija je čas sa učenikom {html.escape(str(data.get('client_full_name', '')))} "
            f"prebacila profesoru {html.escape(str(data.get('teacher_name', '')))}. Termin više nije u vašem rasporedu."
        )
        details_role = "teacher"
    elif role == "client":
        title = "Vaš čas je premešten"
        intro = "Administracija je izmenila vaš čas. Ovo su novi detalji."
        details_role = "client"
    elif role == "teacher":
        title = "Izmena časa u vašem rasporedu"
        intro = "Čas vam je dodeljen ili mu je promenjen termin. Ovo su novi detalji."
        details_role = "teacher"
    else:
        title = "Čas je premešten"
        intro = "Rezervacija je izmenjena iz admin panela."
        details_role = "admin"

    cancel_section = ""
    if cancel_url:
        safe_cancel_url = html.escape(cancel_url, quote=True)
        cancel_section = f"""
        <p style="color:#7c817a; font-size:13px; margin-top:16px;">
            Ako vam novi termin ne odgovara, čas možete otkazati najkasnije 24 sata pre početka:
            <a href="{safe_cancel_url}" style="color:#1f4d3a; font-weight:700;">otkaži čas</a>.
        </p>
        """

    content = f"""
    <h2 style="color:#1f4d3a; margin:0 0 4px; font-size:20px;">{title}</h2>
    <p style="color:#4f5751; margin:0 0 8px; font-size:15px;">{intro}</p>
    {_booking_details_html(data, role=details_role)}
    {cancel_section}
    """
    return _base_html(content)


def _build_late_cancellation_html(data: dict) -> str:
    """HTML za odbijeno otkazivanje (istekao rok od 24h)."""
    content = f"""
    <h2 style="color:#a8701c; margin:0 0 4px; font-size:20px;">Otkazivanje nije moguće</h2>
    <p style="color:#4f5751; margin:0 0 20px; font-size:15px;">
        Nažalost, prošao je rok za otkazivanje časa (24 sata pre početka).
        <strong style="color:#1e2421;">Čas se mora naplatiti.</strong>
    </p>
    {_booking_details_html(data, role="client")}
    <p style="color:#7c817a; font-size:13px; margin-top:16px;">
        Za pitanja nas kontaktirajte direktno.
    </p>
    """
    return _base_html(content)


# =============================================
#  Helper: ORM booking → email data dict
# =============================================

def booking_to_email_data(booking) -> dict:
    """
    Konvertuje Booking ORM objekat u dict pogodan za email templejte.
    Može se koristiti i sa dict-om koji ima iste ključeve.
    """
    att_names = []
    if hasattr(booking, "attachments") and booking.attachments:
        att_names = [
            a.original_name
            for a in sorted(booking.attachments, key=lambda x: x.sort_order)
        ]
    return {
        "subject_name": booking.subject.name if hasattr(booking, "subject") and booking.subject else "N/A",
        "teacher_name": booking.teacher.full_name if hasattr(booking, "teacher") and booking.teacher else "N/A",
        "start_time": booking.start_time,
        "end_time": booking.end_time,
        "duration_minutes": booking.duration_minutes,
        "classroom_number": booking.classroom_number,
        "client_full_name": booking.client_full_name,
        "client_email": booking.client_email,
        "client_category": booking.client_category,
        "client_note": booking.client_note,
        "delivery_mode": getattr(booking, "delivery_mode", "in_person"),
        "session_type": getattr(booking, "session_type", "individual"),
        "attachment_names": att_names,
    }
