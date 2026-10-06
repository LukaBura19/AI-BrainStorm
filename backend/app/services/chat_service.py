"""
AI asistent uz snimke za pripreme (Claude API).

Učenik pita o zadacima sa snimka, a odgovor se šalje deo po deo dok nastaje (SSE).
Bez ANTHROPIC_API_KEY asistent je isključen; stranice sa snimcima rade i bez njega.
"""

import logging
from typing import AsyncIterator, Dict, List, Optional

import anthropic

from app.core.config import settings
from app.services.prep_catalog import LectureContext

logger = logging.getLogger("brainstorm.chat")

# Kad model odbije zahtev, API ga u istom pozivu ponovi na rezervnom modelu koji Anthropic preporučuje.
FALLBACK_BETA = "server-side-fallback-2026-07-01"

REFUSAL_MESSAGE = "Na ovo pitanje asistent ne može da odgovori. Pitaj nešto o zadacima sa snimka."

_client: Optional[anthropic.AsyncAnthropic] = None


def is_configured() -> bool:
    return bool(settings.ANTHROPIC_API_KEY)


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


def build_system_prompt(ctx: LectureContext) -> str:
    lecture = ctx.lecture
    tasks = "\n".join(
        f"{number}. {task.text}" + (f"\n   Rešenje: {task.solution}" if task.solution else "")
        for number, task in enumerate(lecture.tasks, start=1)
    ) or "Zadaci za ovaj snimak još nisu uneti."
    audience = ctx.exam.audience or "učenik koji se sprema za ispit"

    return f"""Ti si asistent Edukativnog centra BrainStorm iz Beograda. Učenik gleda snimak sa rešenim zadacima i tebi postavlja pitanja dok uči.

Snimak: {lecture.title}
Priprema: {ctx.exam.title}, predmet {ctx.subject.name}, oblast {ctx.group.name}
O čemu je snimak: {lecture.summary or lecture.title}
Ko ti piše: {audience}

Zadaci sa snimka i njihova tačna rešenja:
{tasks}

Kako odgovaraš:
- Piši na srpskom, latinicom, toplo i jednostavno, kao strpljiv profesor. Obraćaj se učeniku sa „ti”.
- Kad učenik pita kako se rešava zadatak, objasni korak po korak i reci zašto se radi baš tako. Oslanjaj se na rešenja iznad, pa krajnji rezultat neka bude isti kao tamo.
- Kad učenik pošalje svoj postupak, nađi tačno mesto gde je pogrešio, objasni grešku i pusti ga da sam završi kad god može.
- Ako traži još vežbe, smisli sličan zadatak istog nivoa, a rešenje daj tek kad pokuša ili kad ga zatraži.
- Ako ne razumeš šta učenik pita, postavi jedno kratko pitanje.
- Ne znaš šta profesor priča na snimku, znaš samo zadatke iznad. Ne izmišljaj šta je rečeno na snimku.
- Drži se gradiva ovog predmeta. Na pitanja koja nemaju veze sa učenjem odgovori ljubazno u jednoj rečenici i vrati razgovor na zadatke.
- Odgovori neka budu kratki, najčešće do 150 reči. Duže samo kad rešavaš ceo zadatak.
- Pišeš u običan prozor za dopisivanje: kratki pasusi, po potrebi numerisani koraci ili lista i **podebljano** za ključne pojmove. Bez naslova, tabela i LaTeX-a. Formule piši običnim tekstom sa znakovima kao što su x², √, ·, :, ≤, ≥, ≠, π, ½.
- Ako učenik želi čas uživo sa profesorom, reci mu da može da ga zakaže na sajtu, u delu „Zakaži čas”."""


def _error(message: str) -> Dict[str, str]:
    return {"type": "error", "message": message}


def _log_usage(message) -> None:
    usage = message.usage
    fallback_ran = any(getattr(entry, "type", None) == "fallback_message" for entry in (usage.iterations or []))
    logger.info(
        "Asistent: model=%s stop=%s ulaz=%s izlaz=%s keš=%s%s",
        message.model,
        message.stop_reason,
        usage.input_tokens,
        usage.output_tokens,
        usage.cache_read_input_tokens,
        " (odgovorio rezervni model)" if fallback_ran else "",
    )


async def stream_reply(ctx: LectureContext, messages: List[Dict[str, str]]) -> AsyncIterator[Dict[str, str]]:
    """
    Strimuje odgovor asistenta kao događaje:
      {"type": "delta", "text": ...}       deo odgovora
      {"type": "done", "stop_reason": ...} kraj (max_tokens znači da je odgovor odsečen)
      {"type": "refusal", "message": ...}  model nije hteo da odgovori, delimičan tekst ne važi
      {"type": "error", "message": ...}    greška; tekst za učenika, detalji idu u log
    """
    try:
        async with get_client().beta.messages.stream(
            model=settings.CHAT_MODEL,
            max_tokens=settings.CHAT_MAX_TOKENS,
            system=[{"type": "text", "text": build_system_prompt(ctx)}],
            messages=messages,
            output_config={"effort": settings.CHAT_EFFORT},
            cache_control={"type": "ephemeral"},
            betas=[FALLBACK_BETA],
            fallbacks="default",
        ) as stream:
            async for event in stream:
                if event.type == "content_block_delta" and event.delta.type == "text_delta":
                    yield {"type": "delta", "text": event.delta.text}
            final = await stream.get_final_message()
    except anthropic.AuthenticationError:
        logger.error("Claude API ne prihvata ANTHROPIC_API_KEY; proveri ključ u .env")
        yield _error("Asistent trenutno nije dostupan. Pokušaj ponovo kasnije.")
        return
    except anthropic.PermissionDeniedError as exc:
        logger.error("Claude API: nalog nema pristup modelu %s: %s", settings.CHAT_MODEL, exc)
        yield _error("Asistent trenutno nije dostupan. Pokušaj ponovo kasnije.")
        return
    except anthropic.RateLimitError:
        logger.warning("Claude API: dostignut limit zahteva")
        yield _error("Asistent je trenutno zauzet. Pokušaj ponovo za minut.")
        return
    except anthropic.BadRequestError as exc:
        logger.error("Claude API je odbio zahtev: %s", exc)
        yield _error("Ova poruka ne može da se obradi. Probaj da je skratiš ili počni novi razgovor.")
        return
    except anthropic.APIStatusError as exc:
        logger.error("Claude API greška %s: %s", exc.status_code, exc)
        yield _error("Asistent je trenutno preopterećen. Pokušaj ponovo za koji trenutak.")
        return
    except anthropic.APIConnectionError as exc:
        logger.warning("Claude API: veza prekinuta: %s", exc)
        yield _error("Veza sa asistentom je prekinuta. Pokušaj ponovo.")
        return
    except Exception:
        logger.exception("Asistent: neočekivana greška")
        yield _error("Nešto nije u redu sa asistentom. Pokušaj ponovo.")
        return

    _log_usage(final)
    if final.stop_reason == "refusal":
        details = final.stop_details
        logger.warning("Asistent je odbio odgovor (kategorija: %s)", details.category if details else None)
        yield {"type": "refusal", "message": REFUSAL_MESSAGE}
        return
    yield {"type": "done", "stop_reason": final.stop_reason or "end_turn"}
