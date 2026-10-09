"""
Katalog snimaka za pripreme (mala i velika matura).

Sadržaj se drži u app/data/prep_lectures.json: ispit → predmet → oblast → snimak → zadaci.
Novi snimak se dodaje u JSON bez izmena u kodu: vdocipher_id za zaštićen snimak (DRM: ne može da se
preuzme, snimanje ekrana daje crn ekran), youtube_id ili video_url za javan, nezaštićen snimak.
Rešenja zadataka ne idu na stranicu; koristi ih samo asistent da bi proveravao rad učenika.
"""

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "prep_lectures.json"
SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
VDOCIPHER_ID = re.compile(r"^[A-Za-z0-9]{32}$")


class PrepTask(BaseModel):
    text: str = Field(min_length=1)
    solution: Optional[str] = None


class PrepLecture(BaseModel):
    slug: str = Field(pattern=SLUG_PATTERN)
    title: str = Field(min_length=1)
    summary: str = ""
    youtube_id: Optional[str] = None
    video_url: Optional[str] = None
    # Video ID iz VdoCipher kontrolne table; snimak se tada pušta samo kroz DRM plejer.
    vdocipher_id: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=None, ge=1)
    tasks: List[PrepTask] = []

    @field_validator("youtube_id")
    @classmethod
    def _youtube_id(cls, value: Optional[str]) -> Optional[str]:
        if value and not YOUTUBE_ID.match(value):
            raise ValueError("youtube_id mora biti ID od 11 znakova (deo linka posle watch?v=)")
        return value or None

    @field_validator("vdocipher_id")
    @classmethod
    def _vdocipher_id(cls, value: Optional[str]) -> Optional[str]:
        if value and not VDOCIPHER_ID.match(value):
            raise ValueError("vdocipher_id mora biti Video ID od 32 znaka iz VdoCipher kontrolne table")
        return value or None

    @model_validator(mode="after")
    def _protected_video_has_no_public_copy(self):
        # API vraća youtube_id i video_url, pa bi uz zaštićen snimak otkrili njegovu nezaštićenu kopiju.
        if self.vdocipher_id and (self.youtube_id or self.video_url):
            raise ValueError(f"Snimak '{self.slug}' ima vdocipher_id, pa ne sme imati i youtube_id ili video_url (preko njih bi mogao da se preuzme)")
        return self

    @property
    def has_video(self) -> bool:
        return bool(self.vdocipher_id or self.youtube_id or self.video_url)


class PrepGroup(BaseModel):
    slug: str = Field(pattern=SLUG_PATTERN)
    name: str = Field(min_length=1)
    lectures: List[PrepLecture] = []


class PrepSubject(BaseModel):
    slug: str = Field(pattern=SLUG_PATTERN)
    name: str = Field(min_length=1)
    tagline: Optional[str] = None
    groups: List[PrepGroup] = []

    @model_validator(mode="after")
    def _unique_lecture_slugs(self):
        # Snimak se u URL-u traži samo po predmetu, pa slug mora biti jedinstven unutar predmeta.
        seen = set()
        for group in self.groups:
            for lecture in group.lectures:
                if lecture.slug in seen:
                    raise ValueError(f"Snimak '{lecture.slug}' se ponavlja u predmetu '{self.slug}'")
                seen.add(lecture.slug)
        return self


class PrepExam(BaseModel):
    slug: str = Field(pattern=SLUG_PATTERN)
    title: str = Field(min_length=1)
    lead: str = ""
    # Kome se asistent obraća (ulazi u uputstvo za asistenta, ne prikazuje se na stranici).
    audience: str = ""
    subjects: List[PrepSubject] = []


class PrepCatalog(BaseModel):
    exams: List[PrepExam]

    @model_validator(mode="after")
    def _unique_slugs(self):
        exam_slugs = [exam.slug for exam in self.exams]
        if len(exam_slugs) != len(set(exam_slugs)):
            raise ValueError("Ispiti u katalogu moraju imati različite slugove")
        for exam in self.exams:
            subject_slugs = [subject.slug for subject in exam.subjects]
            if len(subject_slugs) != len(set(subject_slugs)):
                raise ValueError(f"Predmeti u ispitu '{exam.slug}' moraju imati različite slugove")
        return self


class LectureContext(BaseModel):
    """Snimak zajedno sa ispitom, predmetom i oblašću kojima pripada."""

    exam: PrepExam
    subject: PrepSubject
    group: PrepGroup
    lecture: PrepLecture


@lru_cache(maxsize=1)
def load_catalog() -> PrepCatalog:
    return PrepCatalog.model_validate(json.loads(CATALOG_PATH.read_text(encoding="utf-8")))


def get_exam(exam_slug: str) -> Optional[PrepExam]:
    return next((exam for exam in load_catalog().exams if exam.slug == exam_slug), None)


def find_lecture(exam_slug: str, subject_slug: str, lecture_slug: str) -> Optional[LectureContext]:
    exam = get_exam(exam_slug)
    if not exam:
        return None
    subject = next((item for item in exam.subjects if item.slug == subject_slug), None)
    if not subject:
        return None
    for group in subject.groups:
        for lecture in group.lectures:
            if lecture.slug == lecture_slug:
                return LectureContext(exam=exam, subject=subject, group=group, lecture=lecture)
    return None
