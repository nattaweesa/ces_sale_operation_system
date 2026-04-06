from __future__ import annotations
from app.models.user import User
from app.models.brand import Brand
from app.models.category import Category
from app.models.product import Product, ProductAttachment
from app.models.customer import Customer, Contact
from app.models.project import Project
from app.models.boq import BOQ, BOQItem
from app.models.quotation import (
    Quotation, QuotationSection, QuotationLine, QuotationRevision
)
from app.models.material_approval import (
    MaterialApprovalPackage, MaterialApprovalItem
)
from app.models.deal import Deal, DealTask, DealActivity
from app.models.audit import AuditLog
from app.models.sourcing import (
    SourceDocument,
    SourceLineItem,
    ProductAlias,
    ProductPriceHistory,
    LineMatchReviewQueue,
)
from app.models.quotation_intake import (
    QuotationIntakeDocument,
    QuotationIntakeLine,
)
from app.models.master_data_ingestion import (
    MasterIngestionBatch,
    MasterIngestionDocument,
    MasterIngestionDocumentHeader,
    MasterIngestionDocumentSection,
    MasterIngestionRawLine,
    MasterIngestionNormalizedLine,
    MasterProductCandidate,
    MasterCandidateMatchSuggestion,
    MasterPriceObservation,
    MasterReviewActionLog,
)

__all__ = [
    "User",
    "Brand", "Category",
    "Product", "ProductAttachment",
    "Customer", "Contact",
    "Project",
    "BOQ", "BOQItem",
    "Quotation", "QuotationSection", "QuotationLine", "QuotationRevision",
    "QuotationIntakeDocument", "QuotationIntakeLine",
    "MasterIngestionBatch", "MasterIngestionDocument", "MasterIngestionDocumentHeader", "MasterIngestionDocumentSection",
    "MasterIngestionRawLine", "MasterIngestionNormalizedLine", "MasterProductCandidate", "MasterCandidateMatchSuggestion",
    "MasterPriceObservation", "MasterReviewActionLog",
    "MaterialApprovalPackage", "MaterialApprovalItem",
    "Deal", "DealTask", "DealActivity",
    "SourceDocument", "SourceLineItem", "ProductAlias", "ProductPriceHistory", "LineMatchReviewQueue",
    "AuditLog",
]
