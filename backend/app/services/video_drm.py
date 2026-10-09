"""
Zaštićeni snimci: Widevine/FairPlay DRM preko VdoCipher-a.

Snimak se otpremi u VdoCipher kontrolnu tablu, a njegov Video ID upiše u katalog kao vdocipher_id.
Pri svakom gledanju server svojim tajnim ključem traži jednokratnu propusnicu (OTP) i pregledaču
vraća samo adresu plejera. Video se dešifruje tek u zaštićenom delu uređaja, pa ne može da se
preuzme, a skrinšot i snimanje ekrana daju crn ekran gde to uređaj podržava. Preko slike ide
vodeni žig sa identitetom gledaoca, za slučaj snimanja ekrana telefonom.
"""

import json
import logging
from typing import Optional
from urllib.parse import urlparse

import httpx

from app.core.config import settings

logger = logging.getLogger("brainstorm.video")

API_URL = "https://dev.vdocipher.com"
PLAYER_URL = "https://player.vdocipher.com/v2/"
# Propusnica važi kratko: dovoljno da se plejer učita, prekratko da bi vredelo deliti je.
OTP_TTL_SECONDS = 300


class PlaybackError(Exception):
    """VdoCipher nije izdao propusnicu (mreža, pogrešan ključ, nepostojeći snimak)."""


def is_configured() -> bool:
    return bool(settings.VDOCIPHER_API_SECRET)


def allowed_site_pattern() -> Optional[str]:
    """Regex za whitelisthref: plejer radi samo na našem domenu (sa www. ili bez njega).

    VdoCipher ovaj regex traži u nazivu domena stranice. Bez početka i kraja prošao bi i tuđ domen
    koji samo sadrži naš (brainstorm.rs.napadac.com), a nevezana tačka menja bilo koji znak. Šablon
    prihvata i ceo link (https://domen/putanja), da radi i ako se poredi sa celim href-om.
    Tačke se escapuju ručno: re.escape bi escapovao i crticu, a JavaScript regex to ne prihvata uvek.
    """
    host = urlparse(settings.FRONTEND_URL).hostname
    if not host:
        return None
    host = host.removeprefix("www.").replace(".", r"\.")
    return rf"^(https?://)?(www\.)?{host}(:\d+)?(/|$)"


def get_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=API_URL,
        timeout=10.0,
        headers={"Authorization": f"Apisecret {settings.VDOCIPHER_API_SECRET}", "Accept": "application/json"},
    )


def watermark(viewer: str) -> str:
    """Tekst koji se naizmenično pojavljuje i nestaje na promenljivom mestu slike (rtext).

    VdoCipher traži da annotate bude JSON string unutar JSON tela zahteva (dvostruka serijalizacija).
    Siva boja se vidi i na beloj tabli i na tamnoj pozadini.
    """
    return json.dumps([{
        "type": "rtext",
        "text": viewer,
        "alpha": "0.55",
        "color": "0x9A9A9A",
        "size": "14",
        "interval": "5000",
        "skip": "5000",
    }])


async def issue_playback(video_id: str, viewer: str) -> dict:
    """Jednokratna propusnica za plejer: {"otp": ..., "playbackInfo": ...}."""
    site = allowed_site_pattern()
    if not site:
        # Bez domena bi propusnica radila na bilo kom sajtu; bolje da snimak ne krene nego da se ugradi bilo gde.
        logger.error("FRONTEND_URL %r nema domen (treba npr. https://brainstorm.rs), pa se zaštićeni snimci ne puštaju", settings.FRONTEND_URL)
        raise PlaybackError("FRONTEND_URL bez domena")
    body = {"ttl": OTP_TTL_SECONDS, "annotate": watermark(viewer), "whitelisthref": site}
    try:
        async with get_client() as client:
            response = await client.post(f"/api/videos/{video_id}/otp", json=body)
    except httpx.HTTPError as exc:
        logger.warning("VdoCipher nije dostupan za snimak %s: %s", video_id, exc)
        raise PlaybackError("VdoCipher nije dostupan") from exc
    if response.status_code != 200:
        logger.warning("VdoCipher odbio propusnicu za snimak %s: HTTP %s %s", video_id, response.status_code, response.text[:200])
        raise PlaybackError(f"HTTP {response.status_code}")
    try:
        data = response.json()
    except ValueError:
        data = None
    if not (isinstance(data, dict) and data.get("otp") and data.get("playbackInfo")):
        logger.warning("VdoCipher vratio neočekivan odgovor za snimak %s", video_id)
        raise PlaybackError("neočekivan odgovor")
    return {"otp": data["otp"], "playbackInfo": data["playbackInfo"]}
