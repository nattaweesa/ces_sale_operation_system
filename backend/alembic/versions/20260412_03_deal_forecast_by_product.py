"""extend deal monthly forecast to support product/system type split

Revision ID: 20260412_03
Revises: 20260412_02
Create Date: 2026-04-12 21:55:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260412_03"
down_revision: Union[str, Sequence[str], None] = "20260412_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "deal_forecast_monthly",
        sa.Column("product_system_type_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_deal_forecast_monthly_product_system_type",
        "deal_forecast_monthly",
        "deal_product_system_types",
        ["product_system_type_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.drop_constraint(
        "uq_deal_forecast_monthly_deal_year_month",
        "deal_forecast_monthly",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_deal_forecast_monthly_deal_year_month_product",
        "deal_forecast_monthly",
        ["deal_id", "forecast_year", "forecast_month", "product_system_type_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_deal_forecast_monthly_deal_year_month_product",
        "deal_forecast_monthly",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_deal_forecast_monthly_deal_year_month",
        "deal_forecast_monthly",
        ["deal_id", "forecast_year", "forecast_month"],
    )
    op.drop_constraint(
        "fk_deal_forecast_monthly_product_system_type",
        "deal_forecast_monthly",
        type_="foreignkey",
    )
    op.drop_column("deal_forecast_monthly", "product_system_type_id")
