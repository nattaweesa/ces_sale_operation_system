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

__all__ = [
    "User",
    "Brand", "Category",
    "Product", "ProductAttachment",
    "Customer", "Contact",
    "Project",
    "BOQ", "BOQItem",
    "Quotation", "QuotationSection", "QuotationLine", "QuotationRevision",
    "MaterialApprovalPackage", "MaterialApprovalItem",
    "Deal", "DealTask", "DealActivity",
    "AuditLog",
]
