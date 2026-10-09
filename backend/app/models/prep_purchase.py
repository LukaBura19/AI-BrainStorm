from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class PrepPurchase(Base):
    """Plaćen pristup snimcima jedne pripreme (mala ili velika matura) za jedan učenički nalog."""

    __tablename__ = "prep_purchases"
    # Jedan učenik plaća jednu pripremu najviše jednom.
    __table_args__ = (UniqueConstraint("student_id", "exam_slug", name="uq_prep_purchases_student_exam"),)

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    exam_slug = Column(String(64), nullable=False)
    amount_eur = Column(Integer, nullable=False)
    card_brand = Column(String(32), nullable=False)
    card_last4 = Column(String(4), nullable=False)
    transaction_id = Column(String(64), nullable=False, unique=True)
    paid_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    # ponytail: nema kolone status; dodati je kad se uvedu povraćaji novca.

    student = relationship("Student", back_populates="prep_purchases")

    @property
    def receipt_number(self) -> str:
        return f"BS-{self.id:06d}"
