"""merge heads: job_applications (careers) i prep_purchases (plaćeni snimci)

Obe migracije nastavljaju d4e5f6a7b8c9 i nastale su u isto vreme; ova samo spaja grane.

Revision ID: ffb5c1c991ca
Revises: e5f6a7b8c9d0, 0f3764c1e906
Create Date: 2026-10-09

"""
from typing import Sequence, Union


revision: str = "ffb5c1c991ca"
down_revision: Union[str, Sequence[str], None] = ("e5f6a7b8c9d0", "0f3764c1e906")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
