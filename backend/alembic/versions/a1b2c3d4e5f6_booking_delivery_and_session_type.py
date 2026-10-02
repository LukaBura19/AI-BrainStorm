"""booking delivery_mode and session_type

Revision ID: a1b2c3d4e5f6
Revises: cf12736ea042
Create Date: 2026-04-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "cf12736ea042"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column(
            "delivery_mode",
            sa.String(length=20),
            nullable=False,
            server_default="in_person",
        ),
    )
    op.add_column(
        "bookings",
        sa.Column(
            "session_type",
            sa.String(length=20),
            nullable=False,
            server_default="individual",
        ),
    )
    op.drop_constraint("ck_booking_classroom", "bookings", type_="check")
    op.create_check_constraint(
        "ck_booking_delivery_classroom",
        "bookings",
        "(delivery_mode = 'online' AND classroom_number = 0) OR "
        "(delivery_mode = 'in_person' AND classroom_number IN (1, 2))",
    )
    op.create_check_constraint(
        "ck_booking_delivery_mode",
        "bookings",
        "delivery_mode IN ('online', 'in_person')",
    )
    op.create_check_constraint(
        "ck_booking_session_type",
        "bookings",
        "session_type IN ('individual', 'group')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_booking_session_type", "bookings", type_="check")
    op.drop_constraint("ck_booking_delivery_mode", "bookings", type_="check")
    op.drop_constraint("ck_booking_delivery_classroom", "bookings", type_="check")
    op.drop_column("bookings", "session_type")
    op.drop_column("bookings", "delivery_mode")
    op.create_check_constraint(
        "ck_booking_classroom",
        "bookings",
        "classroom_number IN (1, 2)",
    )
