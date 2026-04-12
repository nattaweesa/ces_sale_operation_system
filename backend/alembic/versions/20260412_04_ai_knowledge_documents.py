"""add ai knowledge documents table

Revision ID: 20260412_04
Revises: 20260412_03
Create Date: 2026-04-12 20:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260412_04"
down_revision: Union[str, None] = "20260412_03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_knowledge_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("source_filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=True),
        sa.Column("stored_path", sa.String(length=500), nullable=True),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("content_chars", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("uploaded_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_knowledge_documents_is_active", "ai_knowledge_documents", ["is_active"], unique=False)
    op.create_index("ix_ai_knowledge_documents_created_at", "ai_knowledge_documents", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ai_knowledge_documents_created_at", table_name="ai_knowledge_documents")
    op.drop_index("ix_ai_knowledge_documents_is_active", table_name="ai_knowledge_documents")
    op.drop_table("ai_knowledge_documents")
