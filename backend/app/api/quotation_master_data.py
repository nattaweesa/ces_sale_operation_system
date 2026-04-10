from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.customer import Contact, Customer
from app.models.product import Product
from app.models.project import Project
from app.models.user import User
from app.schemas.quotation_master_data import (
    ContactExtractionCandidateOut,
    CustomerExtractionCandidateOut,
    ExistingMatchOut,
    ProductExtractionCandidateOut,
    ProjectExtractionCandidateOut,
    QuotationMasterDataPreviewOut,
)
from app.services.auth import require_roles
from app.services.quotation_intake_service import extract_text_from_pdf, parse_product_lines

router = APIRouter(prefix="/quotation-master-data", tags=["quotation-master-data"])

LABEL_PATTERNS = {
    "customer": [r"customer", r"company", r"client", r"sold\s*to"],
    "project": [r"project(?:\s*name)?", r"site", r"job(?:\s*name)?"],
    "contact": [r"attention", r"attn", r"contact(?:\s*person)?", r"to"],
}

EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
PHONE_RE = re.compile(r"(?:\+?\d[\d\s().-]{7,}\d)")


def _normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    cleaned = "".join(ch.lower() if ch.isalnum() else " " for ch in value)
    return " ".join(cleaned.split())


def _normalize_phone(value: Optional[str]) -> str:
    if not value:
        return ""
    return "".join(ch for ch in value if ch.isdigit())


def _compact(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    compacted = " ".join(value.replace("\u00a0", " ").split())
    return compacted or None


def _extract_labeled_value(text: str, labels: list[str]) -> Optional[str]:
    lines = [" ".join((line or "").split()) for line in text.splitlines()]
    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        for label in labels:
            pattern = re.compile(rf"^{label}\s*[:\-]?\s*(.+)$", re.IGNORECASE)
            match = pattern.match(line)
            if match:
                value = _compact(match.group(1))
                if value:
                    return value
    return None


def _find_email(text: str) -> Optional[str]:
    match = EMAIL_RE.search(text)
    return match.group(0) if match else None


def _find_phone(text: str) -> Optional[str]:
    match = PHONE_RE.search(text)
    return _compact(match.group(0)) if match else None


def _match_customer(candidate_name: Optional[str], candidate_email: Optional[str], candidate_phone: Optional[str], customers: list[Customer]) -> list[ExistingMatchOut]:
    matches: list[ExistingMatchOut] = []
    norm_name = _normalize_text(candidate_name)
    norm_email = _normalize_text(candidate_email)
    norm_phone = _normalize_phone(candidate_phone)
    for customer in customers:
        reasons: list[str] = []
        if norm_name and _normalize_text(customer.name) == norm_name:
            reasons.append("customer_name_exact")
        if norm_email and _normalize_text(customer.email) == norm_email:
            reasons.append("customer_email_exact")
        if norm_phone and _normalize_phone(customer.phone) == norm_phone:
            reasons.append("customer_phone_exact")
        if reasons:
            matches.append(ExistingMatchOut(id=customer.id, label=customer.name, reason=", ".join(reasons)))
    return matches


def _match_project(candidate_name: Optional[str], matched_customers: list[ExistingMatchOut], projects: list[Project]) -> list[ExistingMatchOut]:
    if not candidate_name:
        return []
    norm_name = _normalize_text(candidate_name)
    matched_customer_ids = {m.id for m in matched_customers}
    matches: list[ExistingMatchOut] = []
    for project in projects:
        if _normalize_text(project.name) != norm_name:
            continue
        reason = "project_name_exact"
        if matched_customer_ids and project.customer_id in matched_customer_ids:
            reason = "project_name_exact_under_customer"
        matches.append(ExistingMatchOut(id=project.id, label=project.name, reason=reason))
    return matches


def _match_contact(candidate_name: Optional[str], candidate_email: Optional[str], candidate_phone: Optional[str], contacts: list[Contact]) -> list[ExistingMatchOut]:
    matches: list[ExistingMatchOut] = []
    norm_name = _normalize_text(candidate_name)
    norm_email = _normalize_text(candidate_email)
    norm_phone = _normalize_phone(candidate_phone)
    for contact in contacts:
        reasons: list[str] = []
        if norm_email and _normalize_text(contact.email) == norm_email:
            reasons.append("contact_email_exact")
        if norm_phone and _normalize_phone(contact.phone) == norm_phone:
            reasons.append("contact_phone_exact")
        if norm_name and _normalize_text(contact.full_name) == norm_name:
            reasons.append("contact_name_exact")
        if reasons:
            matches.append(ExistingMatchOut(id=contact.id, label=contact.full_name, reason=", ".join(reasons)))
    return matches


def _match_product(line, products: list[Product]) -> list[ExistingMatchOut]:
    matches: list[ExistingMatchOut] = []
    norm_code = _normalize_text(line.item_code)
    norm_desc = _normalize_text(line.description)
    for product in products:
        if norm_code and _normalize_text(product.item_code) == norm_code:
            matches.append(ExistingMatchOut(id=product.id, label=f"{product.item_code} - {product.description}", reason="item_code_exact"))
            continue
        if norm_desc:
            score = SequenceMatcher(None, norm_desc, _normalize_text(product.description)).ratio()
            if score >= 0.95:
                matches.append(ExistingMatchOut(id=product.id, label=f"{product.item_code} - {product.description}", reason=f"description_similarity_{score:.2f}"))
    unique: list[ExistingMatchOut] = []
    seen: set[int] = set()
    for match in matches:
        if match.id in seen:
            continue
        seen.add(match.id)
        unique.append(match)
    return unique[:5]


@router.post("/preview", response_model=QuotationMasterDataPreviewOut)
async def preview_master_data_from_quotation(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager")),
):
    filename = file.filename or "quotation.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF file")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    extracted_text = extract_text_from_pdf(raw_bytes)
    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="Cannot extract text from PDF. Please upload machine-readable PDF")

    product_lines = parse_product_lines(extracted_text)
    customer_name = _extract_labeled_value(extracted_text, LABEL_PATTERNS["customer"])
    project_name = _extract_labeled_value(extracted_text, LABEL_PATTERNS["project"])
    contact_name = _extract_labeled_value(extracted_text, LABEL_PATTERNS["contact"])
    email = _find_email(extracted_text)
    phone = _find_phone(extracted_text)

    products = (await db.execute(select(Product))).scalars().all()
    customers = (await db.execute(select(Customer).options(selectinload(Customer.contacts)))).scalars().all()
    projects = (await db.execute(select(Project))).scalars().all()
    contacts = (await db.execute(select(Contact))).scalars().all()

    warnings: list[str] = []
    if not product_lines:
        warnings.append("No product line items were recognized from this PDF yet.")
    if not customer_name:
        warnings.append("Customer name was not confidently detected.")
    if not project_name:
        warnings.append("Project name was not confidently detected.")
    if not contact_name and not email and not phone:
        warnings.append("Contact person details were not confidently detected.")

    customer_matches = _match_customer(customer_name, email, phone, customers)
    project_matches = _match_project(project_name, customer_matches, projects)
    contact_matches = _match_contact(contact_name, email, phone, contacts)

    customer_candidate = None
    if customer_name or email or phone:
        customer_candidate = CustomerExtractionCandidateOut(
            name=customer_name,
            email=email,
            phone=phone,
            status="existing" if customer_matches else "new",
            matches=customer_matches,
        )

    project_candidate = None
    if project_name:
        project_candidate = ProjectExtractionCandidateOut(
            name=project_name,
            status="existing" if project_matches else "new",
            matches=project_matches,
        )

    contact_candidates: list[ContactExtractionCandidateOut] = []
    if contact_name or email or phone:
        contact_candidates.append(
            ContactExtractionCandidateOut(
                full_name=contact_name,
                email=email,
                phone=phone,
                status="existing" if contact_matches else "new",
                matches=contact_matches,
            )
        )

    product_candidates = [
        ProductExtractionCandidateOut(
            line_no=line.line_no,
            item_code=line.item_code,
            description=line.description,
            brand=None,
            quantity=float(line.quantity),
            unit=line.unit,
            list_price=float(line.list_price),
            amount=float(line.amount),
            status="existing" if _match_product(line, products) else ("missing_item_code" if not line.item_code else "new"),
            matches=_match_product(line, products),
        )
        for line in product_lines
    ]

    return QuotationMasterDataPreviewOut(
        filename=filename,
        text_preview=extracted_text[:1500],
        warnings=warnings,
        customer=customer_candidate,
        project=project_candidate,
        contacts=contact_candidates,
        products=product_candidates,
    )
