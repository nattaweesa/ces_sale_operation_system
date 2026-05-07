"""add deal product entries

Revision ID: 20260507_02
Revises: 20260505_01
Create Date: 2026-05-07 19:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260507_02"
down_revision: Union[str, Sequence[str], None] = "20260505_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "deal_product_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("deal_id", sa.Integer(), nullable=False),
        sa.Column("product_system_type_id", sa.Integer(), nullable=False),
        sa.Column("probability_pct", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("expected_value", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("expected_po_date", sa.Date(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["deal_id"], ["deals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_system_type_id"], ["deal_product_system_types.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_deal_product_entries_deal_id", "deal_product_entries", ["deal_id"])
    op.create_index(
        "ix_deal_product_entries_product_system_type_id",
        "deal_product_entries",
        ["product_system_type_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_deal_product_entries_product_system_type_id", table_name="deal_product_entries")
    op.drop_index("ix_deal_product_entries_deal_id", table_name="deal_product_entries")
    op.drop_table("deal_product_entries")
