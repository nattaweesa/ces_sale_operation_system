from __future__ import annotations
import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader


_template_dir = os.path.join(os.path.dirname(__file__), "..", "templates")


async def generate_quotation_pdf(snapshot: dict, quotation_id: int, revision_number: int, settings) -> str:
    """Render quotation snapshot to PDF and save to disk. Returns path to generated file."""
    try:
        from weasyprint import HTML
    except Exception as exc:
        raise RuntimeError("WeasyPrint is not available. Install native dependencies to enable PDF generation.") from exc

    out_dir = os.path.join(settings.storage_path, "quotations", str(quotation_id))
    os.makedirs(out_dir, exist_ok=True)
    pdf_path = os.path.join(out_dir, f"rev_{revision_number}.pdf")

    env = Environment(loader=FileSystemLoader(_template_dir))
    template = env.get_template("quotation.html")
    html_content = template.render(
        snapshot=snapshot,
        company_name=settings.company_name,
        company_address=settings.company_address,
        company_phone=settings.company_phone,
        company_email=settings.company_email,
        generated_at=datetime.now().strftime("%d %B %Y"),
    )

    HTML(string=html_content, base_url=_template_dir).write_pdf(pdf_path)
    return pdf_path
