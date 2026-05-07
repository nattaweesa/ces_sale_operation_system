from __future__ import annotations
from app.models.user import User
from app.models.department import Department, UserDepartment
from app.models.brand import Brand
from app.models.category import Category
from app.models.product import Product, ProductAttachment
from app.models.customer import Customer, Contact
from app.models.deal_master import (
    DealCustomerType,
    DealCompany,
    DealProductSystemType,
    DealProjectStatusOption,
    DealCESStageOption,
    DealProductSystemLink,
)
from app.models.project import Project
from app.models.boq import BOQ, BOQItem
from app.models.quotation import (
    Quotation, QuotationSection, QuotationLine, QuotationRevision
)
from app.models.quotation_upload import QuotationUploadFile
from app.models.material_approval import (
    MaterialApprovalPackage, MaterialApprovalItem
)
from app.models.deal import Deal, DealTask, DealActivity, DealProductEntry
from app.models.deal_forecast import DealForecastMonthly
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
from app.models.role_permission import RolePermission
from app.models.user_activity import UserActivityLog
from app.models.ai_setting import AISetting
from app.models.ai_knowledge import AIKnowledgeDocument, AIKnowledgeChunk
from app.models.ai_chat_history import AIChatConversation, AIChatMessage
from app.models.boq_pricing_v2 import (
    BOQRevisionV2,
    BOQRevisionItemV2,
    PricingSessionV2,
    PricingLineV2,
    QuotationV2,
    QuotationSnapshotV2,
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
    "User", "Department", "UserDepartment",
    "Brand", "Category",
    "Product", "ProductAttachment",
    "Customer", "Contact",
    "DealCustomerType", "DealCompany", "DealProductSystemType", "DealProjectStatusOption", "DealCESStageOption", "DealProductSystemLink",
    "Project",
    "BOQ", "BOQItem",
    "Quotation", "QuotationSection", "QuotationLine", "QuotationRevision",
    "QuotationUploadFile",
    "BOQRevisionV2", "BOQRevisionItemV2", "PricingSessionV2", "PricingLineV2", "QuotationV2", "QuotationSnapshotV2",
    "QuotationIntakeDocument", "QuotationIntakeLine",
    "RolePermission",
    "MasterIngestionBatch", "MasterIngestionDocument", "MasterIngestionDocumentHeader", "MasterIngestionDocumentSection",
    "MasterIngestionRawLine", "MasterIngestionNormalizedLine", "MasterProductCandidate", "MasterCandidateMatchSuggestion",
    "MasterPriceObservation", "MasterReviewActionLog",
    "MaterialApprovalPackage", "MaterialApprovalItem",
    "Deal", "DealTask", "DealActivity", "DealProductEntry",
    "DealForecastMonthly",
    "SourceDocument", "SourceLineItem", "ProductAlias", "ProductPriceHistory", "LineMatchReviewQueue",
    "AuditLog",
    "AISetting",
    "AIKnowledgeDocument",
    "AIKnowledgeChunk",
    "AIChatConversation",
    "AIChatMessage",
]
