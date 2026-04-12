"""add deal master data phase1

Revision ID: 20260412_01
Revises: 20260410_02
Create Date: 2026-04-12 11:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260412_01"
down_revision: Union[str, Sequence[str], None] = "20260410_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Customers table already has PRIMARY KEY from schema dump
    # Migration performs other schema changes instead

    op.create_table(
        "deal_customer_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "deal_project_status_options",
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

    op.create_table(
        "deal_product_system_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "deal_companies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("customer_type_id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["customer_type_id"], ["deal_customer_types.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("customer_id", name="uq_deal_companies_customer_id"),
        sa.UniqueConstraint("customer_type_id", "name", name="uq_deal_companies_type_name"),
    )

    op.add_column("deals", sa.Column("deal_customer_type_id", sa.Integer(), nullable=True))
    op.add_column("deals", sa.Column("deal_company_id", sa.Integer(), nullable=True))
    op.create_foreign_key(None, "deals", "deal_customer_types", ["deal_customer_type_id"], ["id"])
    op.create_foreign_key(None, "deals", "deal_companies", ["deal_company_id"], ["id"])

    op.create_table(
        "deal_product_system_links",
        sa.Column("deal_id", sa.Integer(), nullable=False),
        sa.Column("product_system_type_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["deal_id"], ["deals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_system_type_id"], ["deal_product_system_types.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("deal_id", "product_system_type_id"),
    )

    customer_type_table = sa.table(
        "deal_customer_types",
        sa.column("name", sa.String()),
        sa.column("sort_order", sa.Integer()),
        sa.column("is_active", sa.Boolean()),
    )
    op.bulk_insert(
        customer_type_table,
        [
            {"name": "M&E Design", "sort_order": 10, "is_active": True},
            {"name": "Owner", "sort_order": 20, "is_active": True},
            {"name": "CM/PM", "sort_order": 30, "is_active": True},
            {"name": "QS", "sort_order": 40, "is_active": True},
        ],
    )

    status_table = sa.table(
        "deal_project_status_options",
        sa.column("key", sa.String()),
        sa.column("label", sa.String()),
        sa.column("sort_order", sa.Integer()),
        sa.column("is_active", sa.Boolean()),
    )
    op.bulk_insert(
        status_table,
        [
            {"key": "design", "label": "Design", "sort_order": 10, "is_active": True},
            {"key": "bidding", "label": "Bidding", "sort_order": 20, "is_active": True},
            {"key": "award", "label": "Award", "sort_order": 30, "is_active": True},
            {"key": "on_hold", "label": "On Hold", "sort_order": 40, "is_active": True},
            {"key": "completed", "label": "Completed", "sort_order": 50, "is_active": True},
            {"key": "cancelled", "label": "Cancelled", "sort_order": 60, "is_active": True},
            {"key": "open", "label": "Open (Legacy)", "sort_order": 70, "is_active": True},
            {"key": "won", "label": "Won", "sort_order": 80, "is_active": True},
            {"key": "lost", "label": "Lost", "sort_order": 90, "is_active": True},
        ],
    )


def downgrade() -> None:
    op.drop_table("deal_product_system_links")
    op.drop_constraint(None, "deals", type_="foreignkey")
    op.drop_constraint(None, "deals", type_="foreignkey")
    op.drop_column("deals", "deal_company_id")
    op.drop_column("deals", "deal_customer_type_id")
    op.drop_table("deal_companies")
    op.drop_table("deal_product_system_types")
    op.drop_table("deal_project_status_options")
    op.drop_table("deal_customer_types")