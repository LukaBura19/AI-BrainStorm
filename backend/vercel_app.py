"""
Ulaz za Vercel (servis "api" u vercel.json). Javni zahtevi stižu kao /api/..., a rute aplikacije
nemaju prefiks, pa se aplikacija kači ispod /api. Lokalno i u Dockeru i dalje radi app.main:app.
"""

import os

# Na Vercelu funkcija sme da piše samo u /tmp (privremeno), a MailHog-a nema.
# Vrednosti iz Vercel podešavanja (Environment Variables) imaju prednost.
os.environ.setdefault("UPLOAD_DIR", "/tmp/uploads/booking_attachments")
os.environ.setdefault("MAIL_ENABLED", "false")
if os.environ.get("VERCEL_PROJECT_PRODUCTION_URL"):
    os.environ.setdefault("FRONTEND_URL", f"https://{os.environ['VERCEL_PROJECT_PRODUCTION_URL']}")

from fastapi import FastAPI  # noqa: E402

from app.main import app as api  # noqa: E402

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/api", api)
