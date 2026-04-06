"""module1 master data ingestion tables

Revision ID: 20260406_01
Revises: 
Create Date: 2026-04-06 22:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260406_01"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "md_ingestion_batches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("total_files", sa.Integer(), nullable=False),
        sa.Column("processed_files", sa.Integer(), nullable=False),
        sa.Column("failed_files", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_md_ingestion_batches_uploaded_by"), "md_ingestion_batches", ["uploaded_by"], unique=False)

    op.create_table(
        "md_ingestion_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("batch_id", sa.Integer(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_path", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("parse_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["batch_id"], ["md_ingestion_batches.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_md_ingestion_documents_batch_id"), "md_ingestion_documents", ["batch_id"], unique=False)

    op.create_table(
        "md_document_headers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("quotation_number", sa.String(length=120), nullable=True),
        sa.Column("project_name", sa.String(length=200), nullable=True),
        sa.Column("quote_date_text", sa.String(length=100), nullable=True),
        sa.Column("subject", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["md_ingestion_documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_id"),
    )

    op.create_table(
        "md_document_sections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("section_name", sa.String(length=200), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["md_ingestion_documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_md_document_sections_document_id"), "md_document_sections", ["document_id"], unique=False)

    op.create_table(
        "md_raw_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("section_id", sa.Integer(), nullable=True),
        sa.Column("line_no", sa.Integer(), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("item_code_raw", sa.String(length=120), nullable=True),
        sa.Column("description_raw", sa.Text(), nullable=True),
        sa.Column("brand_raw", sa.String(length=120), nullable=True),
        sa.Column("list_price_raw", sa.String(length=120), nullable=True),
        sa.Column("qty_raw", sa.String(length=80), nullable=True),
        sa.Column("discount_text_raw", sa.String(length=120), nullable=True),
        sa.Column("total_amount_raw", sa.String(length=120), nullable=True),
        sa.Column("parse_confidence", sa.Numeric(5, 2), nullable=True),
        sa.Column("parse_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["md_ingestion_documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["section_id"], ["md_document_sections.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_md_raw_lines_document_id"), "md_raw_lines", ["document_id"], unique=False)

    op.create_table(
        "md_normalized_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("raw_line_id", sa.Integer(), nullable=False),
        sa.Column("classification", sa.String(length=30), nullable=False),
        sa.Column("item_code_norm", sa.String(length=120), nullable=True),
        sa.Column("description_norm", sa.Text(), nullable=True),
        sa.Column("brand_norm", sa.String(length=120), nullable=True),
        sa.Column("unit_norm", sa.String(length=30), nullable=True),
        sa.Column("list_price_norm", sa.Numeric(14, 2), nullable=True),
        sa.Column("qty_norm", sa.Numeric(12, 3), nullable=True),
        sa.Column("amount_norm", sa.Numeric(14, 2), nullable=True),
        sa.Column("uncertain", sa.Boolean(), nullable=False),
        sa.Column("normalize_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["raw_line_id"], ["md_raw_lines.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("raw_line_id"),
    )

    op.create_table(
        "md_product_candidates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("normalized_line_id", sa.Integer(), nullable=False),
        sa.Column("candidate_code", sa.String(length=120), nullable=True),
        sa.Column("canonical_description", sa.Text(), nullable=True),
        sa.Column("canonical_brand", sa.String(length=120), nullable=True),
        sa.Column("selected_list_price", sa.Numeric(14, 2), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("chosen_product_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["chosen_product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["normalized_line_id"], ["md_normalized_lines.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("normalized_line_id"),
    )

    op.create_table(
        "md_candidate_match_suggestions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("candidate_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("method", sa.String(length=40), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 2), nullable=False),
        sa.Column("notes", sa.String(length=200), nullable=True),
        sa.ForeignKeyConstraint(["candidate_id"], ["md_product_candidates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_md_candidate_match_suggestions_candidate_id"), "md_candidate_match_suggestions", ["candidate_id"], unique=False)

    op.create_table(
        "md_price_observations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("candidate_id", sa.Integer(), nullable=False),
        sa.Column("observed_list_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False),
        sa.Column("source_document_id", sa.Integer(), nullable=True),
        sa.Column("source_raw_line_id", sa.Integer(), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["md_product_candidates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_document_id"], ["md_ingestion_documents.id"]),
        sa.ForeignKeyConstraint(["source_raw_line_id"], ["md_raw_lines.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_md_price_observations_candidate_id"), "md_price_observations", ["candidate_id"], unique=False)

    op.create_table(
        "md_review_action_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("candidate_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=30), nullable=False),
        sa.Column("reviewer_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("selected_list_price", sa.Numeric(14, 2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("evidence_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["md_product_candidates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_md_review_action_logs_candidate_id"), "md_review_action_logs", ["candidate_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_md_review_action_logs_candidate_id"), table_name="md_review_action_logs")
    op.drop_table("md_review_action_logs")

    op.drop_index(op.f("ix_md_price_observations_candidate_id"), table_name="md_price_observations")
    op.drop_table("md_price_observations")

    op.drop_index(op.f("ix_md_candidate_match_suggestions_candidate_id"), table_name="md_candidate_match_suggestions")
    op.drop_table("md_candidate_match_suggestions")

    op.drop_table("md_product_candidates")
    op.drop_table("md_normalized_lines")

    op.drop_index(op.f("ix_md_raw_lines_document_id"), table_name="md_raw_lines")
    op.drop_table("md_raw_lines")

    op.drop_index(op.f("ix_md_document_sections_document_id"), table_name="md_document_sections")
    op.drop_table("md_document_sections")

    op.drop_table("md_document_headers")

    op.drop_index(op.f("ix_md_ingestion_documents_batch_id"), table_name="md_ingestion_documents")
    op.drop_table("md_ingestion_documents")

    op.drop_index(op.f("ix_md_ingestion_batches_uploaded_by"), table_name="md_ingestion_batches")
    op.drop_table("md_ingestion_batches")
