"""add ai_settings table

Revision ID: 20260410_02
Revises: 20260410_01
Create Date: 2026-04-10 14:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260410_02"
down_revision: Union[str, None] = "20260410_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=30), nullable=False, server_default="minimax"),
        sa.Column("model", sa.String(length=100), nullable=False, server_default="MiniMax-M2.7-highspeed"),
        sa.Column("api_key_encrypted", sa.Text(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_settings_provider", "ai_settings", ["provider"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ai_settings_provider", table_name="ai_settings")
    op.drop_table("ai_settings")
