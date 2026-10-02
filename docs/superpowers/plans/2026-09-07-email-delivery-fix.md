# Email delivery fix

> **For agentic workers:** Use superpowers:executing-plans to execute the regression tests, implementation and verification in this workspace.

**Goal:** Connect real transactional email and stop reporting local SMTP capture as external delivery.

**Architecture:** Keep the existing synchronous SMTP service and booking behavior. Distinguish captured messages in its existing notification result, reuse the SMTP connection for a diagnostic command, and configure an authorized sender when its credentials are available.

**Tech Stack:** FastAPI, Python smtplib, Pydantic settings, React, pytest and Playwright.

**Spec:** User request: “i dalje se ne salju mailovi, popravi to”. Runtime diagnosis: MAIL_SERVER=mailhog, port 1025, no SMTP username or password; MailHog has captured messages. No real sender is configured.

## Constraints

- Preserve reservations, cancellation links and the current design.
- Do not expose credentials or send test messages to unrelated recipients.
- Do not claim MailHog capture or SMTP acceptance proves inbox delivery.
- Do not invent sender credentials or register a paid provider.

## Tasks

- [x] Write and run failing regressions for MailHog capture (`sent=0`, `captured=3`, `status=captured`), SMTP refusals and the diagnostic exit status.
- [x] Update `backend/app/core/config.py` and SMTP service to distinguish capture and validate incomplete credentials. Keep accepted SMTP message handling separate from confirmed inbox delivery.
- [x] Update `NotificationDelivery` and booking/cancellation notices so captured or unknown statuses never claim recipients were notified.
- [x] Add `python -m app.check_email` using the same SMTP connection path. Default invocation only checks connection/authentication; explicit `--to` sends one diagnostic message. Report capture with exit 2, failures with exit 1, external SMTP acceptance with exit 0.
- [x] Update `.env.example`, Compose and README with transport mode and the diagnostic command. Restart instructions must recreate the backend after `.env` edits.
- [x] Run backend regressions and frontend build; exercise booking/cancellation in Playwright with MailHog and assert capture warnings.
- [ ] Configure the user's real SMTP sender when credentials are available and verify SMTP acceptance of an authorized test message. This step remains pending until the sender is supplied.

## Review

Tests must cover TLS before authentication, refused recipients and local capture. A successful reservation must retain its cancel link even if email is unavailable. External delivery remains unverified until an actual SMTP provider is configured.

Verified: 69 backend tests pass, frontend production build passes, 4 browser E2E tests pass with MailHog capture warnings. Runtime diagnostic returns exit 2 for MailHog and sends no message by default. Review identified false success for late-cancellation notices and configuration-error credential exposure; both have failing-then-passing regressions and fixes. User has been asked for sender/provider; real SMTP credentials are still absent. No external test message has been sent.

Follow-up: user supplied the center Gmail address. Local `.env` now stages Gmail SMTP at port 587 with STARTTLS and that address as sender/username and admin notification recipient. `MAIL_ENABLED=false` until the user supplies an App password. Disabled mail permits partial credentials so startup and booking remain available; enabled mail still validates both credentials. A live unauthenticated Gmail connection completed TLS 1.3 and NOOP 250. Authentication and inbox delivery remain unverified; no email was sent. The user has been given the Google App Password link and asked to enter the credential locally.

Credential verification follow-up: the user entered a password in `.env`. A temporary Compose container loaded the updated value and attempted SMTP authentication once with `MAIL_ENABLED=true`; Gmail rejected it with SMTP 535. Metadata-only checks confirmed the correct sender/username, TLS, port and delivery mode, no duplicate mail keys, no whitespace or literal quotes in the parsed password, and a length inconsistent with a Google App password even after whitespace removal. No credential was printed. The running API remains healthy with email disabled; no test message was sent. A valid Google App password from the center account is required to finish activation.
