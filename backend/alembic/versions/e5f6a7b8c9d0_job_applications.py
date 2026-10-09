"""job_applications table

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "job_applications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=40), nullable=False),
        sa.Column("degree", sa.String(length=60), nullable=False),
        sa.Column("subjects", sa.String(length=400), nullable=False),
        sa.Column("experience", sa.String(length=60), nullable=True),
        sa.Column("about", sa.Text(), nullable=True),
        sa.Column("cv_stored_name", sa.String(length=255), nullable=False),
        sa.Column("cv_original_name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_job_applications_id"), "job_applications", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_job_applications_id"), table_name="job_applications")
    op.drop_table("job_applications")
