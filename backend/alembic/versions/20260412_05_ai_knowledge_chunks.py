"""add ai knowledge chunks table

Revision ID: 20260412_05
Revises: 20260412_04
Create Date: 2026-04-12 20:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260412_05"
down_revision: Union[str, None] = "20260412_04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_knowledge_chunks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("content_chars", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["document_id"], ["ai_knowledge_documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_knowledge_chunks_document_id", "ai_knowledge_chunks", ["document_id"], unique=False)
    op.create_index("ix_ai_knowledge_chunks_chunk_index", "ai_knowledge_chunks", ["chunk_index"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ai_knowledge_chunks_chunk_index", table_name="ai_knowledge_chunks")
    op.drop_index("ix_ai_knowledge_chunks_document_id", table_name="ai_knowledge_chunks")
    op.drop_table("ai_knowledge_chunks")
