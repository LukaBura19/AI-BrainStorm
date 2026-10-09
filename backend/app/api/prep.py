"""
Pripreme za malu i veliku maturu: katalog snimaka, stranica snimka i AI asistent uz svaki snimak.
"""

import json
import logging
import time
from collections import defaultdict, deque
from datetime import datetime
from typing import Deque, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_optional_student
from app.core.security import create_access_token, hash_password
from app.db.session import get_db
from app.models.prep_purchase import PrepPurchase
from app.models.student import Student
from app.schemas.auth import StudentMe
from app.services import chat_service, email_service, payment_service
from app.services.prep_catalog import PrepExam, PrepLecture, find_lecture, get_exam

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


class AccessOut(BaseModel):
    """Da li prijavljeni učenik ima plaćen pristup snimcima i šta se dobija kupovinom."""
    price_eur: int
    includes: List[str]
    signed_in: bool
    purchased: bool


class ExamOut(BaseModel):
    slug: str
    title: str
    lead: str
    chat_available: bool
    access: AccessOut
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
    # Video stiže samo učeniku sa plaćenim pristupom; has_video kaže da li snimak uopšte postoji.
    has_video: bool
    youtube_id: Optional[str] = None
    video_url: Optional[str] = None
    duration_minutes: Optional[int] = None
    tasks: List[str]
    chat_available: bool
    access: AccessOut
    previous: Optional[LectureLink] = None
    next: Optional[LectureLink] = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


class CardIn(BaseModel):
    number: str = Field(min_length=12, max_length=25)
    exp_month: int = Field(ge=1, le=12)
    exp_year: int = Field(ge=0, le=2100)
    cvc: str = Field(min_length=3, max_length=4)
    holder_name: str = Field(min_length=2, max_length=255)


class CheckoutRequest(BaseModel):
    """Bez prijave: ime, email i lozinka prave nalog. Prijavljen učenik šalje samo karticu."""
    full_name: Optional[str] = Field(default=None, max_length=255)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, max_length=128)
    card: CardIn


class PurchaseOut(BaseModel):
    exam: NamedRef
    amount_eur: int
    card_brand: str
    card_last4: str
    receipt_number: str
    paid_at: datetime


class CheckoutResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    account_created: bool
    student: StudentMe
    purchase: PurchaseOut


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

def _card(lecture: PrepLecture, unlocked: bool) -> LectureCard:
    return LectureCard(
        slug=lecture.slug,
        title=lecture.title,
        summary=lecture.summary,
        youtube_id=lecture.youtube_id if unlocked else None,
        has_video=lecture.has_video,
        duration_minutes=lecture.duration_minutes,
        task_count=len(lecture.tasks),
    )


def purchased_exams(student: Optional[Student]) -> set:
    return {purchase.exam_slug for purchase in student.prep_purchases} if student else set()


def _access(exam: PrepExam, student: Optional[Student]) -> AccessOut:
    return AccessOut(price_eur=exam.price_eur, includes=exam.includes, signed_in=student is not None, purchased=exam.slug in purchased_exams(student))


def purchase_out(purchase: PrepPurchase) -> PurchaseOut:
    exam = get_exam(purchase.exam_slug)
    return PurchaseOut(
        exam=NamedRef(slug=purchase.exam_slug, name=exam.title if exam else purchase.exam_slug),
        amount_eur=purchase.amount_eur,
        card_brand=purchase.card_brand,
        card_last4=purchase.card_last4,
        receipt_number=purchase.receipt_number,
        paid_at=purchase.paid_at,
    )


def _fail(status_code: int, code: str, message: str):
    """Greška sa kodom koji frontend može da prepozna (npr. da ponudi prijavu)."""
    raise HTTPException(status_code=status_code, detail={"code": code, "message": message})


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
def get_prep_exam(exam_slug: str, student: Optional[Student] = Depends(get_optional_student)):
    """Svi predmeti, oblasti i snimci jedne pripreme (bez rešenja zadataka). Video ID samo uz plaćen pristup."""
    exam = get_exam(exam_slug)
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Priprema nije pronađena.")
    access = _access(exam, student)
    return ExamOut(
        slug=exam.slug,
        title=exam.title,
        lead=exam.lead,
        chat_available=chat_service.is_configured(),
        access=access,
        subjects=[
            SubjectOut(
                slug=subject.slug,
                name=subject.name,
                tagline=subject.tagline,
                groups=[GroupOut(slug=group.slug, name=group.name, lectures=[_card(lecture, access.purchased) for lecture in group.lectures]) for group in subject.groups],
            )
            for subject in exam.subjects
        ],
    )


@router.get("/{exam_slug}/{subject_slug}/{lecture_slug}", response_model=LectureDetail)
def get_prep_lecture(exam_slug: str, subject_slug: str, lecture_slug: str, student: Optional[Student] = Depends(get_optional_student)):
    """Jedan snimak: zadaci i susedni snimci za sve; video samo za učenika sa plaćenim pristupom."""
    ctx = _lecture_or_404(exam_slug, subject_slug, lecture_slug)
    ordered = [lecture for group in ctx.subject.groups for lecture in group.lectures]
    position = next(index for index, lecture in enumerate(ordered) if lecture.slug == ctx.lecture.slug)
    previous = ordered[position - 1] if position > 0 else None
    following = ordered[position + 1] if position + 1 < len(ordered) else None
    lecture = ctx.lecture
    access = _access(ctx.exam, student)
    return LectureDetail(
        exam=NamedRef(slug=ctx.exam.slug, name=ctx.exam.title),
        subject=NamedRef(slug=ctx.subject.slug, name=ctx.subject.name),
        group=NamedRef(slug=ctx.group.slug, name=ctx.group.name),
        slug=lecture.slug,
        title=lecture.title,
        summary=lecture.summary,
        has_video=lecture.has_video,
        youtube_id=lecture.youtube_id if access.purchased else None,
        video_url=lecture.video_url if access.purchased else None,
        duration_minutes=lecture.duration_minutes,
        tasks=[task.text for task in lecture.tasks],
        chat_available=chat_service.is_configured(),
        access=access,
        previous=LectureLink(slug=previous.slug, title=previous.title) if previous else None,
        next=LectureLink(slug=following.slug, title=following.title) if following else None,
    )


@router.post("/{exam_slug}/checkout", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
def checkout_prep_access(
    exam_slug: str,
    payload: CheckoutRequest,
    db: Session = Depends(get_db),
    student: Optional[Student] = Depends(get_optional_student),
):
    """
    Plaćanje pristupa snimcima jedne pripreme. Bez prijave se iz imena, emaila i lozinke pravi
    učenički nalog; nalog i kupovina se upisuju tek kad naplata prođe. Vraća token za prijavu.
    """
    exam = get_exam(exam_slug)
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Priprema nije pronađena.")

    # 1) Provera podataka pre naplate, da odbijena kartica ne ostavi ni nalog ni kupovinu.
    new_account = None
    if student is None:
        full_name = (payload.full_name or "").strip()
        if len(full_name) < 2 or not payload.email:
            _fail(status.HTTP_422_UNPROCESSABLE_ENTITY, "missing_details", "Unesi ime i prezime i email adresu.")
        email = str(payload.email).lower()
        if db.query(Student).filter(func.lower(Student.email) == email).first():
            _fail(status.HTTP_409_CONFLICT, "account_exists", "Nalog sa ovom email adresom već postoji. Prijavi se pa nastavi kupovinu.")
        if not payload.password or len(payload.password) < 8:
            _fail(status.HTTP_422_UNPROCESSABLE_ENTITY, "weak_password", "Lozinka za nalog mora imati najmanje 8 karaktera.")
        new_account = Student(
            full_name=full_name,
            email=email,
            password_hash=hash_password(payload.password),
            category="osnovna" if exam.slug == "mala-matura" else "srednja",
        )
    elif exam.slug in purchased_exams(student):
        _fail(status.HTTP_409_CONFLICT, "already_purchased", f"Već imaš pristup paketu {exam.title}.")

    # 2) Naplata.
    card = payload.card
    try:
        charged = payment_service.charge(
            number=card.number, exp_month=card.exp_month, exp_year=card.exp_year, cvc=card.cvc,
            holder_name=card.holder_name, amount_eur=exam.price_eur,
        )
    except payment_service.CardError as error:
        _fail(status.HTTP_402_PAYMENT_REQUIRED, "card_declined", str(error))

    # 3) Nalog (ako je nov) i kupovina u jednoj transakciji.
    account_created = new_account is not None
    purchase = PrepPurchase(
        exam_slug=exam.slug,
        amount_eur=exam.price_eur,
        card_brand=charged.brand,
        card_last4=charged.last4,
        transaction_id=charged.transaction_id,
    )
    try:
        if account_created:
            student = new_account
            db.add(student)
            db.flush()
        purchase.student_id = student.id
        db.add(purchase)
        db.commit()
    except IntegrityError:
        # Dva istovremena zahteva (dupli klik, dva taba): drugi udari u jedinstven email ili (učenik, priprema).
        # ponytail: lažna naplata se ne vraća; pravi provajder ovde traži povraćaj ili idempotency ključ.
        db.rollback()
        if account_created:
            _fail(status.HTTP_409_CONFLICT, "account_exists", "Nalog sa ovom email adresom već postoji. Prijavi se pa nastavi kupovinu.")
        _fail(status.HTTP_409_CONFLICT, "already_purchased", f"Već imaš pristup paketu {exam.title}.")
    db.refresh(purchase)
    db.refresh(student)
    logger.info("Pristup plaćen: %s, učenik #%s, %s € (%s)", exam.slug, student.id, exam.price_eur, purchase.receipt_number)

    try:
        email_service.send_prep_purchase_receipt(
            to=student.email, full_name=student.full_name, exam_title=exam.title, exam_slug=exam.slug,
            amount_eur=purchase.amount_eur, card_brand=purchase.card_brand, card_last4=purchase.card_last4,
            receipt_number=purchase.receipt_number, paid_at=purchase.paid_at, account_created=account_created,
        )
    except Exception:  # email ne sme da sruši već plaćenu kupovinu
        logger.exception("Potvrda kupovine nije poslata (%s)", purchase.receipt_number)

    return CheckoutResponse(
        access_token=create_access_token(data={"sub": str(student.id), "role": "student", "email": student.email}),
        account_created=account_created,
        student=StudentMe.model_validate(student),
        purchase=purchase_out(purchase),
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
