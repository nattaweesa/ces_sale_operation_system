"""add user_activity_logs table and last_login_at column

Revision ID: 20260410_01
Revises: 20260408_01
Create Date: 2026-04-10 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260410_01"
down_revision: Union[str, None] = "20260408_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "user_activity_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.Integer(), nullable=True),
        sa.Column("resource_label", sa.String(500), nullable=True),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_activity_logs_user_id", "user_activity_logs", ["user_id"])
    op.create_index("ix_user_activity_logs_created_at", "user_activity_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_user_activity_logs_created_at", table_name="user_activity_logs")
    op.drop_index("ix_user_activity_logs_user_id", table_name="user_activity_logs")
    op.drop_table("user_activity_logs")
    op.drop_column("users", "last_login_at")
