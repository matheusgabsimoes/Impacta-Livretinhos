"""create books table

Revision ID: 202609140001
Revises: 202609110001
Create Date: 2026-09-14 00:00:01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "202609140001"
down_revision: Union[str, None] = "202609110001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "books",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("theme", sa.String(length=120), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("books")
