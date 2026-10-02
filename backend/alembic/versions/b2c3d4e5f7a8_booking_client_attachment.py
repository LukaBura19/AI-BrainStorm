"""booking client attachment columns

Revision ID: b2c3d4e5f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-04-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f7a8"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column("client_attachment_stored_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "bookings",
        sa.Column("client_attachment_original_name", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("bookings", "client_attachment_original_name")
    op.drop_column("bookings", "client_attachment_stored_name")
