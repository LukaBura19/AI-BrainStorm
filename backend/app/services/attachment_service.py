"""
Čuvanje priloga uz javnu rezervaciju (PDF ili slika).
"""

import os
import re
from pathlib import Path
from typing import Optional, Tuple

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

# Dozvoljene ekstenzije (mala slova)
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}



def _sanitize_original_name(name: str) -> str:
    # Browser može poslati i Windows putanju; sve vrste whitespace-a svodimo na
    # običan razmak da naziv nikada ne unese novi HTTP header pri preuzimanju.
    base = os.path.basename((name or "").replace("\\", "/")).strip()
    base = re.sub(r"[^\w\s.\-()ćčđšžĆČĐŠŽ]", "", base, flags=re.UNICODE)
    base = re.sub(r"\s+", " ", base).strip()
    if len(base) > 200:
        base = base[:200]
    return base or "prilog"


def _ext_from_filename(filename: str) -> str:
    lower = (filename or "").lower().strip()
    for ext in sorted(ALLOWED_EXTENSIONS, key=len, reverse=True):
        if lower.endswith(ext):
            return ext
    return ""


def _content_matches_extension(content: bytes, ext: str) -> bool:
    """Proverava magic bytes, jer ekstenzija i browser MIME mogu biti lažirani."""
    if ext == ".pdf":
        return content.startswith(b"%PDF-")
    if ext == ".png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if ext in {".jpg", ".jpeg"}:
        return content.startswith(b"\xff\xd8\xff")
    if ext == ".webp":
        return len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP"
    return False


def validate_attachment_upload(upload: UploadFile) -> Tuple[bytes, str, str]:
    """
    Čita telo fajla, proverava veličinu i ekstenziju.

    Returns:
        (sadržaj, bezbedno originalno ime, ekstenzija uklj. tačke)
    """
    if not upload.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Neispravan naziv priloga.",
        )
    ext = _ext_from_filename(upload.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dozvoljeni formati priloga: PDF, JPG, PNG, WEBP.",
        )
    # Čitamo najviše jedan bajt preko limita; tako veliki upload ne završava
    # ceo u memoriji aplikacije samo da bismo zatim utvrdili da je prevelik.
    content = upload.file.read(settings.MAX_ATTACHMENT_BYTES + 1)
    if len(content) > settings.MAX_ATTACHMENT_BYTES:
        mb = max(1, round(settings.MAX_ATTACHMENT_BYTES / (1024 * 1024)))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Prilog je prevelik (maks. {mb} MB po fajlu).",
        )
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prazan prilog nije dozvoljen.",
        )
    if not _content_matches_extension(content, ext):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sadržaj priloga ne odgovara izabranom formatu fajla.",
        )
    orig = _sanitize_original_name(upload.filename)
    return content, orig, ext


def ensure_upload_dir() -> Path:
    base = Path(settings.UPLOAD_DIR)
    base.mkdir(parents=True, exist_ok=True)
    return base


def stored_filename_for_booking(booking_id: int, ext: str) -> str:
    """Jedinstveno ime na disku (bez pomeranja iz booking ID)."""
    from secrets import token_hex

    return f"{booking_id}_{token_hex(8)}{ext}"


def resolve_attachment_path(stored_name: str) -> Path:
    """Vraća apsolutnu putanju ako je ispod UPLOAD_DIR (zaštita od path traversal)."""
    base = Path(settings.UPLOAD_DIR).resolve()
    path = (base / stored_name).resolve()
    if not path.is_relative_to(base) or path == base:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Neispravan prilog.")
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prilog nije pronađen.")
    return path


def save_booking_attachment(booking_id: int, content: bytes, ext: str) -> str:
    """Upisuje fajl i vraća stored_name."""
    ensure_upload_dir()
    stored = stored_filename_for_booking(booking_id, ext)
    path = Path(settings.UPLOAD_DIR) / stored
    path.write_bytes(content)
    return stored


def delete_booking_attachment_file(stored_name: str) -> None:
    """Best-effort čišćenje fajla ako DB transakcija ne uspe."""
    try:
        path = resolve_attachment_path(stored_name)
    except HTTPException:
        return
    path.unlink(missing_ok=True)
