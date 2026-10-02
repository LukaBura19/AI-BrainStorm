from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.utils.datetime_utils import normalize_to_utc


class BookingAttachmentItem(BaseModel):
    """Kratak prikaz priloga u API odgovoru."""

    id: int
    original_name: str

    model_config = {"from_attributes": True}


class NotificationDelivery(BaseModel):
    """Rezultat pokušaja slanja transakcionih obaveštenja."""

    sent: int
    captured: int = 0
    failed: int
    total: int
    status: str


# --------------- Request schemas ---------------

class BookingCreate(BaseModel):
    """Schema za kreiranje rezervacije (javni endpoint)."""

    # Predmet i profesor
    subject_id: int = Field(..., gt=0, description="ID predmeta")
    teacher_id: int = Field(..., gt=0, description="ID profesora")

    # Termin
    start_time: datetime = Field(..., examples=["2026-03-23T10:00:00"])
    duration: int = Field(..., description="Trajanje časa: 45, 60 ili 90 minuta")

    # Podaci o klijentu
    client_full_name: str = Field(..., min_length=2, max_length=255, examples=["Marko Marković"])
    client_email: EmailStr = Field(..., examples=["marko@gmail.com"])
    client_category: str = Field(
        ...,
        description="Kategorija: osnovna, srednja, faks, drugo",
        examples=["srednja"],
    )
    client_note: Optional[str] = Field(
        None,
        max_length=1000,
        description="Napomena klijenta (opciono)",
    )

    delivery_mode: str = Field(
        "in_person",
        description="online — na daljinu; in_person — uživo u sali",
    )
    session_type: str = Field(
        "individual",
        description="individual — individualni čas; group — grupni čas",
    )

    @model_validator(mode="after")
    def validate_fields(self):
        self.start_time = normalize_to_utc(self.start_time)
        if self.duration not in (45, 60, 90):
            raise ValueError("Trajanje časa mora biti 45, 60 ili 90 minuta.")

        valid_categories = ("osnovna", "srednja", "faks", "drugo")
        if self.client_category not in valid_categories:
            raise ValueError(
                f"Kategorija mora biti jedna od: {', '.join(valid_categories)}."
            )

        if self.delivery_mode not in ("online", "in_person"):
            raise ValueError("Način održavanja mora biti 'online' ili 'in_person'.")

        if self.session_type not in ("individual", "group"):
            raise ValueError("Tip časa mora biti 'individual' ili 'group'.")

        return self


# --------------- Response schemas ---------------

class BookingResponse(BaseModel):
    """Schema za prikaz rezervacije."""
    id: int
    subject_id: int
    subject_name: str
    teacher_id: int
    teacher_name: str

    client_full_name: str
    client_email: str
    client_category: str
    client_note: Optional[str] = None
    attachments: list[BookingAttachmentItem] = Field(default_factory=list)

    delivery_mode: str
    session_type: str

    start_time: datetime
    end_time: datetime
    duration_minutes: int

    status: str
    classroom_number: int

    cancelled_by: Optional[str] = None
    cancellation_reason: Optional[str] = None

    client_cancel_token: Optional[str] = None  # Samo u odgovoru na kreiranje
    notification_delivery: Optional[NotificationDelivery] = None

    created_at: datetime

    model_config = {"from_attributes": True}


def attachments_from_booking(booking) -> list[BookingAttachmentItem]:
    """Gradi listu priloga iz ORM bookinga (lazy ili eager učitano)."""
    rows = list(getattr(booking, "attachments", None) or [])
    rows.sort(key=lambda x: x.sort_order)
    return [BookingAttachmentItem(id=a.id, original_name=a.original_name) for a in rows]


class BookingListResponse(BaseModel):
    """Schema za listu rezervacija."""
    items: list[BookingResponse]
    total: int


class BookingCancelRequest(BaseModel):
    """Schema za otkazivanje rezervacije od strane klijenta."""
    token: str = Field(..., min_length=16, max_length=255, description="Secure cancel token dobijen pri kreiranju")
    reason: Optional[str] = Field(None, max_length=500, description="Razlog otkazivanja")


class BookingCancelPreviewResponse(BaseModel):
    """Ograničeni detalji rezervacije dostupni vlasniku sigurnog tokena."""

    booking_id: int
    subject_name: str
    teacher_name: str
    start_time: datetime
    end_time: datetime
    duration_minutes: int
    delivery_mode: str
    session_type: str
    classroom_number: int
    status: str
    can_cancel: bool
    cancellation_deadline: datetime


class BookingCancelResponse(BaseModel):
    """Odgovor na otkazivanje."""
    detail: str
    booking_id: int
    status: str
    notification_delivery: Optional[NotificationDelivery] = None


class BookingReassign(BaseModel):
    """Schema za prebacivanje rezervacije (admin)."""
    teacher_id: Optional[int] = Field(None, gt=0, description="Novi profesor ID")
    subject_id: Optional[int] = Field(None, gt=0, description="Novi predmet ID")
    start_time: Optional[datetime] = Field(None, description="Novo početno vreme")
    duration: Optional[int] = Field(None, description="Novo trajanje: 45, 60, 90")

    @model_validator(mode="after")
    def validate_fields(self):
        if self.start_time is not None:
            self.start_time = normalize_to_utc(self.start_time)
        if self.duration is not None and self.duration not in (45, 60, 90):
            raise ValueError("Trajanje časa mora biti 45, 60 ili 90 minuta.")

        # Bar jedno polje mora biti postavljeno
        if all(v is None for v in [self.teacher_id, self.subject_id, self.start_time, self.duration]):
            raise ValueError("Morate proslediti bar jedno polje za izmenu.")

        return self
