# Svi modeli moraju biti importovani ovde da bi Alembic i Base.metadata
# mogli da ih detektuju pri kreiranju migracija.

from app.models.subject import Subject
from app.models.teacher import Teacher
from app.models.admin import Admin
from app.models.student import Student
from app.models.teacher_subject import TeacherSubject
from app.models.teacher_availability import TeacherAvailability
from app.models.booking import Booking
from app.models.booking_attachment import BookingAttachment
from app.models.job_application import JobApplication

__all__ = [
    "Subject",
    "Teacher",
    "Admin",
    "Student",
    "TeacherSubject",
    "TeacherAvailability",
    "Booking",
    "BookingAttachment",
    "JobApplication",
]
