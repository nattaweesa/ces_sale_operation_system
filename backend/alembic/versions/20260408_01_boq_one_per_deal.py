"""enforce one boq per deal

Revision ID: 20260408_01
Revises: 20260407_03
Create Date: 2026-04-08 10:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260408_01"
down_revision: Union[str, None] = "20260407_03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("boqs", sa.Column("deal_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_boqs_deal_id", "boqs", "deals", ["deal_id"], ["id"])
    op.create_unique_constraint("uq_boqs_deal_id", "boqs", ["deal_id"])


def downgrade() -> None:
    op.drop_constraint("uq_boqs_deal_id", "boqs", type_="unique")
    op.drop_constraint("fk_boqs_deal_id", "boqs", type_="foreignkey")
    op.drop_column("boqs", "deal_id")
