"""prep_purchases: plaćen pristup snimcima za malu i veliku maturu

Revision ID: 0f3764c1e906
Revises: d4e5f6a7b8c9
Create Date: 2026-10-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0f3764c1e906"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "prep_purchases",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("exam_slug", sa.String(length=64), nullable=False),
        sa.Column("amount_eur", sa.Integer(), nullable=False),
        sa.Column("card_brand", sa.String(length=32), nullable=False),
        sa.Column("card_last4", sa.String(length=4), nullable=False),
        sa.Column("transaction_id", sa.String(length=64), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "exam_slug", name="uq_prep_purchases_student_exam"),
        sa.UniqueConstraint("transaction_id"),
    )
    op.create_index(op.f("ix_prep_purchases_id"), "prep_purchases", ["id"], unique=False)
    op.create_index(op.f("ix_prep_purchases_student_id"), "prep_purchases", ["student_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_prep_purchases_student_id"), table_name="prep_purchases")
    op.drop_index(op.f("ix_prep_purchases_id"), table_name="prep_purchases")
    op.drop_table("prep_purchases")
