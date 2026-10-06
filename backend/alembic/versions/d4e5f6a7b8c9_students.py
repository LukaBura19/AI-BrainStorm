"""students table and bookings.student_id

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6b7a0
Create Date: 2026-10-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6b7a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "students",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_students_id"), "students", ["id"], unique=False)
    op.create_index(op.f("ix_students_email"), "students", ["email"], unique=True)

    op.add_column("bookings", sa.Column("student_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_bookings_student_id"), "bookings", ["student_id"], unique=False)
    op.create_foreign_key("fk_bookings_student_id", "bookings", "students", ["student_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("fk_bookings_student_id", "bookings", type_="foreignkey")
    op.drop_index(op.f("ix_bookings_student_id"), table_name="bookings")
    op.drop_column("bookings", "student_id")
    op.drop_index(op.f("ix_students_email"), table_name="students")
    op.drop_index(op.f("ix_students_id"), table_name="students")
    op.drop_table("students")
