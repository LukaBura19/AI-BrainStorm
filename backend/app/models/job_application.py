from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.db.base import Base


class JobApplication(Base):
    """Prijava za posao sa stranice O nama: odgovori iz upitnika i CV (PDF ili slika)."""

    __tablename__ = "job_applications"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(40), nullable=False)
    degree = Column(String(60), nullable=False)
    subjects = Column(String(400), nullable=False)
    experience = Column(String(60), nullable=True)
    about = Column(Text, nullable=True)
    cv_stored_name = Column(String(255), nullable=False)
    cv_original_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
