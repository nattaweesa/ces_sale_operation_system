"""merge: combine departments and deal master

Revision ID: 2d7ff5d801ea
Revises: 20260410_03, 20260412_01
Create Date: 2026-04-12 16:52:43.270160

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2d7ff5d801ea'
down_revision: Union[str, None] = ('20260410_03', '20260412_01')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
