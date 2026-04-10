"""add boq/pricing/quotation v2 tables

Revision ID: 20260407_03
Revises: 3dd00713b1fc
Create Date: 2026-04-07 18:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260407_03"
down_revision: Union[str, None] = "3dd00713b1fc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "boq_revisions_v2",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("boq_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("revision_no", sa.Integer(), nullable=False),
        sa.Column("source_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["boq_id"], ["boqs.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("boq_id", "revision_no", name="uq_boq_revisions_v2_boq_rev"),
    )

    op.create_table(
        "boq_revision_items_v2",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("boq_revision_id", sa.Integer(), nullable=False),
        sa.Column("boq_item_id", sa.Integer(), nullable=True),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("section_label", sa.String(length=150), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 3), nullable=False),
        sa.Column("unit", sa.String(length=30), nullable=True),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("source_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["boq_item_id"], ["boq_items.id"]),
        sa.ForeignKeyConstraint(["boq_revision_id"], ["boq_revisions_v2.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "pricing_sessions_v2",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("boq_revision_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("vat_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["boq_revision_id"], ["boq_revisions_v2.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "pricing_lines_v2",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pricing_session_id", sa.Integer(), nullable=False),
        sa.Column("boq_revision_item_id", sa.Integer(), nullable=True),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("section_label", sa.String(length=150), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("item_code", sa.String(length=100), nullable=True),
        sa.Column("brand", sa.String(length=100), nullable=True),
        sa.Column("quantity", sa.Numeric(12, 3), nullable=False),
        sa.Column("unit", sa.String(length=30), nullable=True),
        sa.Column("list_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("discount_pct", sa.Numeric(5, 2), nullable=False),
        sa.Column("net_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("source_line_ref", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["boq_revision_item_id"], ["boq_revision_items_v2.id"]),
        sa.ForeignKeyConstraint(["pricing_session_id"], ["pricing_sessions_v2.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "quotations_v2",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("quotation_number", sa.String(length=50), nullable=False),
        sa.Column("pricing_session_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("revision_no", sa.Integer(), nullable=False),
        sa.Column("subtotal", sa.Numeric(14, 2), nullable=False),
        sa.Column("vat_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("vat_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("grand_total", sa.Numeric(14, 2), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["pricing_session_id"], ["pricing_sessions_v2.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("quotation_number"),
    )
    op.create_index(op.f("ix_quotations_v2_quotation_number"), "quotations_v2", ["quotation_number"], unique=True)

    op.create_table(
        "quotation_snapshots_v2",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("quotation_id", sa.Integer(), nullable=False),
        sa.Column("revision_no", sa.Integer(), nullable=False),
        sa.Column("snapshot_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("issued_by", sa.Integer(), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["issued_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["quotation_id"], ["quotations_v2.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("quotation_id", "revision_no", name="uq_quotation_snapshots_v2_quote_rev"),
    )


def downgrade() -> None:
    op.drop_table("quotation_snapshots_v2")
    op.drop_index(op.f("ix_quotations_v2_quotation_number"), table_name="quotations_v2")
    op.drop_table("quotations_v2")
    op.drop_table("pricing_lines_v2")
    op.drop_table("pricing_sessions_v2")
    op.drop_table("boq_revision_items_v2")
    op.drop_table("boq_revisions_v2")
