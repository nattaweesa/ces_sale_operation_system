"""merge: combine deal master and department features

Revision ID: 22a11b600df8
Revises: 20260410_03, 20260412_01
Create Date: 2026-04-12 16:50:15.710381

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '22a11b600df8'
down_revision: Union[str, None] = ('20260410_03', '20260412_01')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
