"""add ai chat history tables

Revision ID: 20260412_06
Revises: 20260412_05
Create Date: 2026-04-12 21:15:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260412_06"
down_revision: Union[str, None] = "20260412_05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_chat_conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False, server_default="AI Chat"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_chat_conversations_user_id", "ai_chat_conversations", ["user_id"], unique=False)

    op.create_table(
        "ai_chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["conversation_id"], ["ai_chat_conversations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_chat_messages_conversation_id", "ai_chat_messages", ["conversation_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ai_chat_messages_conversation_id", table_name="ai_chat_messages")
    op.drop_table("ai_chat_messages")
    op.drop_index("ix_ai_chat_conversations_user_id", table_name="ai_chat_conversations")
    op.drop_table("ai_chat_conversations")
