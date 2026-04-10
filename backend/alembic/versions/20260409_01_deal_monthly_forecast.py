"""add deal monthly forecast table

Revision ID: 20260409_01
Revises: 20260408_01
Create Date: 2026-04-09 16:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260409_01"
down_revision: Union[str, None] = "20260408_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "deal_forecast_monthly",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("deal_id", sa.Integer(), nullable=False),
        sa.Column("forecast_year", sa.Integer(), nullable=False),
        sa.Column("forecast_month", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("win_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("net_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["deal_id"], ["deals.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("deal_id", "forecast_year", "forecast_month", name="uq_deal_forecast_monthly_deal_year_month"),
    )
    op.create_index("ix_deal_forecast_monthly_deal_id", "deal_forecast_monthly", ["deal_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_deal_forecast_monthly_deal_id", table_name="deal_forecast_monthly")
    op.drop_table("deal_forecast_monthly")
