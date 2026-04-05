from __future__ import annotations
from typing import Optional
import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from pypdf import PdfWriter, PdfReader


_template_dir = os.path.join(os.path.dirname(__file__), "..", "templates")


async def generate_material_approval_pdf(
    package_id: int,
    quotation_number: str,
    package_name: Optional[str],
    items: list[dict],
    settings,
) -> str:
    """
    Generates a material approval PDF by:
    1. Rendering the cover + material list as HTML → PDF
    2. Merging with all datasheet PDFs
    Returns path to final merged PDF.
    """
    try:
        from weasyprint import HTML
    except Exception as exc:
        raise RuntimeError("WeasyPrint is not available. Install native dependencies to enable PDF generation.") from exc

    out_dir = os.path.join(settings.storage_path, "material_approvals")
    os.makedirs(out_dir, exist_ok=True)

    temp_cover_path = os.path.join(out_dir, f"pkg_{package_id}_cover.pdf")
    final_path = os.path.join(out_dir, f"pkg_{package_id}.pdf")

    # 1. Render cover + list pages
    env = Environment(loader=FileSystemLoader(_template_dir))
    template = env.get_template("material_approval_cover.html")
    html_content = template.render(
        quotation_number=quotation_number,
        package_name=package_name,
        items=items,
        company_name=settings.company_name,
        company_address=settings.company_address,
        generated_at=datetime.now().strftime("%d %B %Y"),
    )
    HTML(string=html_content, base_url=_template_dir).write_pdf(temp_cover_path)

    # 2. Merge with datasheets
    writer = PdfWriter()

    # Add cover pages
    cover_reader = PdfReader(temp_cover_path)
    for page in cover_reader.pages:
        writer.add_page(page)

    # Add each datasheet
    for item in items:
        att_path = item.get("file_path")
        if att_path and os.path.exists(att_path) and att_path.lower().endswith(".pdf"):
            try:
                ds_reader = PdfReader(att_path)
                for page in ds_reader.pages:
                    writer.add_page(page)
            except Exception:
                pass  # Skip unreadable datasheets

    with open(final_path, "wb") as f:
        writer.write(f)

    # Clean up temp
    if os.path.exists(temp_cover_path):
        os.remove(temp_cover_path)

    return final_path
