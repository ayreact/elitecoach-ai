import os
import io
import logging
from datetime import datetime

import cloudinary
import cloudinary.uploader
from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

logger = logging.getLogger(__name__)


def _build_pdf_bytes(user_name: str, course_name: str, verification_code: str, issue_date: datetime) -> bytes:
    """Renders the certificate to an in-memory PDF and returns raw bytes."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=landscape(A4))
    width, height = landscape(A4)

    # Background
    c.setFillColor(HexColor("#f8f9fa"))
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # Outer border
    c.setStrokeColor(HexColor("#2563eb"))
    c.setLineWidth(10)
    c.rect(20, 20, width - 40, height - 40)

    # Inner border
    c.setStrokeColor(HexColor("#93c5fd"))
    c.setLineWidth(2)
    c.rect(30, 30, width - 60, height - 60)

    # Header
    c.setFillColor(HexColor("#1e3a8a"))
    c.setFont("Helvetica-Bold", 36)
    c.drawCentredString(width / 2.0, height - 120, "CERTIFICATE OF COMPLETION")

    # Subtitle
    c.setFillColor(HexColor("#4b5563"))
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2.0, height - 160, "This is to certify that")

    # User name
    c.setFillColor(HexColor("#111827"))
    c.setFont("Helvetica-Bold", 40)
    c.drawCentredString(width / 2.0, height - 230, user_name.upper())

    # Body text
    c.setFillColor(HexColor("#4b5563"))
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2.0, height - 280, "has successfully completed the requirements for the course:")

    # Course name
    c.setFillColor(HexColor("#2563eb"))
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width / 2.0, height - 340, course_name.upper())

    # Divider
    c.setStrokeColor(HexColor("#d1d5db"))
    c.setLineWidth(1)
    c.line(width / 2.0 - 200, height - 380, width / 2.0 + 200, height - 380)

    # Footer — left: date and verification code
    c.setFillColor(HexColor("#6b7280"))
    c.setFont("Helvetica", 12)
    c.drawString(80, 80, f"Issued Date: {issue_date.strftime('%B %d, %Y')}")
    c.drawString(80, 60, f"Verification Code: {verification_code}")

    # Footer — right: signature block
    c.setFont("Helvetica-Bold", 14)
    c.drawString(width - 250, 80, "ELITE COACH AI")
    c.setFont("Helvetica", 12)
    c.drawString(width - 250, 60, "Authorized Signature")

    c.save()
    return buffer.getvalue()


def _upload_to_cloudinary(verification_code: str, pdf_bytes: bytes) -> str:
    """
    Uploads PDF bytes to Cloudinary as a raw file and returns the permanent secure URL.
    Cloudinary stores files on its CDN — they survive redeploys and server restarts.
    """
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True,
    )

    try:
        result = cloudinary.uploader.upload(
            pdf_bytes,
            resource_type="raw",          # Required for non-image files (PDFs)
            public_id=f"elitecoach/certs/{verification_code}",
            format="pdf",
            overwrite=False,              # Never overwrite an issued certificate
        )
        return result["secure_url"]
    except Exception as e:
        logger.error(f"Cloudinary upload failed for cert {verification_code}: {e}")
        raise RuntimeError(f"Failed to upload certificate to Cloudinary: {e}") from e


def _save_locally(verification_code: str, pdf_bytes: bytes) -> str:
    """
    Fallback: saves PDF to local disk under certs/ and returns a /static URL.
    Only suitable for local development — files are lost on cloud redeploys.
    """
    certs_dir = os.path.join(os.getcwd(), "certs")
    os.makedirs(certs_dir, exist_ok=True)
    filepath = os.path.join(certs_dir, f"{verification_code}.pdf")
    with open(filepath, "wb") as f:
        f.write(pdf_bytes)
    logger.warning(
        "Certificate saved to local disk. Set CLOUDINARY_* env vars for production."
    )
    return f"/static/certs/{verification_code}.pdf"


def generate_certificate_pdf(
    user_name: str,
    course_name: str,
    verification_code: str,
    issue_date: datetime,
) -> str:
    """
    Generates a PDF certificate and persists it:
      - To Cloudinary if CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET are set (production).
      - To local disk as a fallback (development only — not safe for Render/cloud).
    Returns the publicly accessible URL of the stored PDF.
    """
    pdf_bytes = _build_pdf_bytes(user_name, course_name, verification_code, issue_date)

    cloudinary_configured = all([
        os.getenv("CLOUDINARY_CLOUD_NAME"),
        os.getenv("CLOUDINARY_API_KEY"),
        os.getenv("CLOUDINARY_API_SECRET"),
    ])

    if cloudinary_configured:
        return _upload_to_cloudinary(verification_code, pdf_bytes)

    return _save_locally(verification_code, pdf_bytes)
