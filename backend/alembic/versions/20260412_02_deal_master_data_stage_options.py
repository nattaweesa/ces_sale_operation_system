"""add deal ces stage options and hide deprecated project statuses

Revision ID: 20260412_02
Revises: 2d7ff5d801ea
Create Date: 2026-04-12 21:20:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260412_02"
down_revision: Union[str, Sequence[str], None] = "2d7ff5d801ea"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "deal_ces_stage_options",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=60), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )

    stage_table = sa.table(
        "deal_ces_stage_options",
        sa.column("key", sa.String()),
        sa.column("label", sa.String()),
        sa.column("sort_order", sa.Integer()),
        sa.column("is_active", sa.Boolean()),
    )
    op.bulk_insert(
        stage_table,
        [
            {"key": "lead", "label": "Lead / Discovery", "sort_order": 10, "is_active": True},
            {"key": "qualified", "label": "Qualified", "sort_order": 20, "is_active": True},
            {"key": "proposal", "label": "Proposal", "sort_order": 30, "is_active": True},
            {"key": "negotiation", "label": "Negotiation", "sort_order": 40, "is_active": True},
            {"key": "won", "label": "Won", "sort_order": 50, "is_active": True},
            {"key": "lost", "label": "Lost", "sort_order": 60, "is_active": True},
        ],
    )

    # Keep only statuses used by client by default; admin can reactivate others later.
    op.execute(
        sa.text(
            """
            UPDATE deal_project_status_options
            SET is_active = false
            WHERE key IN ('completed', 'cancelled', 'open', 'won', 'lost')
            """
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE deal_project_status_options
            SET is_active = true
            WHERE key IN ('completed', 'cancelled', 'open', 'won', 'lost')
            """
        )
    )
    op.drop_table("deal_ces_stage_options")
