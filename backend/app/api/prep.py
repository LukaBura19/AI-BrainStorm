"""
Pripreme za malu i veliku maturu: katalog snimaka, stranica snimka i AI asistent uz svaki snimak.
"""

import json
import logging
import time
from collections import defaultdict, deque
from typing import Deque, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.config import settings
from app.services import chat_service
from app.services.prep_catalog import PrepLecture, find_lecture, get_exam

logger = logging.getLogger("brainstorm.prep")

router = APIRouter(prefix="/public/prep", tags=["Pripreme"])

# Granice razgovora: štite troškove i drže zahtev u razumnoj veličini.
MAX_CHAT_MESSAGES = 40
MAX_USER_MESSAGE_CHARS = 2000
MAX_ASSISTANT_MESSAGE_CHARS = 12000
MAX_CONVERSATION_CHARS = 60000


# ---- Odgovori ----

class LectureCard(BaseModel):
    slug: str
    title: str
    summary: str
    youtube_id: Optional[str] = None
    has_video: bool
    duration_minutes: Optional[int] = None
    task_count: int


class GroupOut(BaseModel):
    slug: str
    name: str
    lectures: List[LectureCard]


class SubjectOut(BaseModel):
    slug: str
    name: str
    tagline: Optional[str] = None
    groups: List[GroupOut]


class ExamOut(BaseModel):
    slug: str
    title: str
    lead: str
    chat_available: bool
    subjects: List[SubjectOut]


class NamedRef(BaseModel):
    slug: str
    name: str


class LectureLink(BaseModel):
    slug: str
    title: str


class LectureDetail(BaseModel):
    exam: NamedRef
    subject: NamedRef
    group: NamedRef
    slug: str
    title: str
    summary: str
    youtube_id: Optional[str] = None
    video_url: Optional[str] = None
    duration_minutes: Optional[int] = None
    tasks: List[str]
    chat_available: bool
    previous: Optional[LectureLink] = None
    next: Optional[LectureLink] = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


# ---- Ograničenje broja poruka po IP adresi ----

class SlidingWindowLimiter:
    """Najviše `limit` poruka u `window` sekundi po ključu. Drži se u memoriji procesa."""

    def __init__(self) -> None:
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    def allow(self, key: str, limit: int, window: float) -> bool:
        now = time.monotonic()
        if len(self._hits) > 5000:
            self._forget_idle(now, window)
        hits = self._hits[key]
        while hits and now - hits[0] >= window:
            hits.popleft()
        if len(hits) >= limit:
            return False
        hits.append(now)
        return True

    def _forget_idle(self, now: float, window: float) -> None:
        for key in [key for key, hits in self._hits.items() if not hits or now - hits[-1] >= window]:
            del self._hits[key]

    def reset(self) -> None:
        self._hits.clear()


chat_limiter = SlidingWindowLimiter()


# ---- Pomoćne funkcije ----

def _card(lecture: PrepLecture) -> LectureCard:
    return LectureCard(
        slug=lecture.slug,
        title=lecture.title,
        summary=lecture.summary,
        youtube_id=lecture.youtube_id,
        has_video=lecture.has_video,
        duration_minutes=lecture.duration_minutes,
        task_count=len(lecture.tasks),
    )


def _lecture_or_404(exam_slug: str, subject_slug: str, lecture_slug: str):
    ctx = find_lecture(exam_slug, subject_slug, lecture_slug)
    if not ctx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snimak nije pronađen.")
    return ctx


def _validate_conversation(messages: List[ChatMessage]) -> None:
    def reject(detail: str):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)

    if not messages:
        reject("Poruka je prazna.")
    if len(messages) > MAX_CHAT_MESSAGES:
        reject("Razgovor je predugačak. Počni novi razgovor.")
    for index, message in enumerate(messages):
        expected = "user" if index % 2 == 0 else "assistant"
        if message.role != expected:
            reject("Razgovor nije u ispravnom redosledu. Počni novi razgovor.")
        if not message.content.strip():
            reject("Poruka je prazna.")
        limit = MAX_USER_MESSAGE_CHARS if message.role == "user" else MAX_ASSISTANT_MESSAGE_CHARS
        if len(message.content) > limit:
            reject(f"Poruka može imati najviše {MAX_USER_MESSAGE_CHARS} znakova." if message.role == "user" else "Razgovor je predugačak. Počni novi razgovor.")
    if messages[-1].role != "user":
        reject("Poslednja poruka mora biti tvoje pitanje.")
    if sum(len(message.content) for message in messages) > MAX_CONVERSATION_CHARS:
        reject("Razgovor je predugačak. Počni novi razgovor.")


# ---- Rute ----

@router.get("/{exam_slug}", response_model=ExamOut)
def get_prep_exam(exam_slug: str):
    """Svi predmeti, oblasti i snimci jedne pripreme (bez rešenja zadataka)."""
    exam = get_exam(exam_slug)
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Priprema nije pronađena.")
    return ExamOut(
        slug=exam.slug,
        title=exam.title,
        lead=exam.lead,
        chat_available=chat_service.is_configured(),
        subjects=[
            SubjectOut(
                slug=subject.slug,
                name=subject.name,
                tagline=subject.tagline,
                groups=[GroupOut(slug=group.slug, name=group.name, lectures=[_card(lecture) for lecture in group.lectures]) for group in subject.groups],
            )
            for subject in exam.subjects
        ],
    )


@router.get("/{exam_slug}/{subject_slug}/{lecture_slug}", response_model=LectureDetail)
def get_prep_lecture(exam_slug: str, subject_slug: str, lecture_slug: str):
    """Jedan snimak: video, zadaci sa snimka i susedni snimci u istom predmetu."""
    ctx = _lecture_or_404(exam_slug, subject_slug, lecture_slug)
    ordered = [lecture for group in ctx.subject.groups for lecture in group.lectures]
    position = next(index for index, lecture in enumerate(ordered) if lecture.slug == ctx.lecture.slug)
    previous = ordered[position - 1] if position > 0 else None
    following = ordered[position + 1] if position + 1 < len(ordered) else None
    lecture = ctx.lecture
    return LectureDetail(
        exam=NamedRef(slug=ctx.exam.slug, name=ctx.exam.title),
        subject=NamedRef(slug=ctx.subject.slug, name=ctx.subject.name),
        group=NamedRef(slug=ctx.group.slug, name=ctx.group.name),
        slug=lecture.slug,
        title=lecture.title,
        summary=lecture.summary,
        youtube_id=lecture.youtube_id,
        video_url=lecture.video_url,
        duration_minutes=lecture.duration_minutes,
        tasks=[task.text for task in lecture.tasks],
        chat_available=chat_service.is_configured(),
        previous=LectureLink(slug=previous.slug, title=previous.title) if previous else None,
        next=LectureLink(slug=following.slug, title=following.title) if following else None,
    )


@router.post("/{exam_slug}/{subject_slug}/{lecture_slug}/chat")
async def chat_about_lecture(exam_slug: str, subject_slug: str, lecture_slug: str, payload: ChatRequest, request: Request):
    """
    Pitanje asistentu o zadacima sa snimka. Odgovor stiže kao text/event-stream:
    svaka linija `data:` nosi JSON događaj (delta, done, refusal ili error).
    """
    ctx = _lecture_or_404(exam_slug, subject_slug, lecture_slug)
    if not chat_service.is_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Asistent još nije podešen.")
    _validate_conversation(payload.messages)

    client_ip = request.client.host if request.client else "unknown"
    if not chat_limiter.allow(client_ip, settings.CHAT_RATE_LIMIT, settings.CHAT_RATE_WINDOW_SECONDS):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Poslao si mnogo poruka za kratko vreme. Sačekaj nekoliko minuta pa pokušaj ponovo.",
        )

    messages = [{"role": message.role, "content": message.content} for message in payload.messages]

    async def events():
        async for event in chat_service.stream_reply(ctx, messages):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
