"""booking_attachments table, drop legacy single-attachment columns

Revision ID: c3d4e5f6b7a0
Revises: b2c3d4e5f7a8
Create Date: 2026-04-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6b7a0"
down_revision: Union[str, None] = "b2c3d4e5f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "booking_attachments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("booking_id", sa.Integer(), nullable=False),
        sa.Column("stored_name", sa.String(length=255), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_booking_attachments_booking_id"),
        "booking_attachments",
        ["booking_id"],
        unique=False,
    )

    op.execute(
        """
        INSERT INTO booking_attachments (booking_id, stored_name, original_name, sort_order)
        SELECT id, client_attachment_stored_name, client_attachment_original_name, 0
        FROM bookings
        WHERE client_attachment_stored_name IS NOT NULL
        """
    )

    op.drop_column("bookings", "client_attachment_original_name")
    op.drop_column("bookings", "client_attachment_stored_name")


def downgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column("client_attachment_stored_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "bookings",
        sa.Column("client_attachment_original_name", sa.String(length=255), nullable=True),
    )

    op.execute(
        """
        UPDATE bookings b
        SET
            client_attachment_stored_name = a.stored_name,
            client_attachment_original_name = a.original_name
        FROM booking_attachments a
        WHERE a.booking_id = b.id
          AND a.sort_order = (
              SELECT MIN(a2.sort_order) FROM booking_attachments a2 WHERE a2.booking_id = b.id
          )
        """
    )

    op.drop_index(op.f("ix_booking_attachments_booking_id"), table_name="booking_attachments")
    op.drop_table("booking_attachments")
