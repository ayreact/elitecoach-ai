import os
from datetime import datetime
from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

def generate_certificate_pdf(user_name: str, course_name: str, verification_code: str, issue_date: datetime) -> str:
    """
    Generates a production-ready, beautiful E-certificate PDF using ReportLab.
    Returns the relative path to the generated PDF.
    """
    certs_dir = os.path.join(os.getcwd(), "certs")
    os.makedirs(certs_dir, exist_ok=True)
    
    filename = f"{verification_code}.pdf"
    filepath = os.path.join(certs_dir, filename)

    # Standard A4 Landscape
    c = canvas.Canvas(filepath, pagesize=landscape(A4))
    width, height = landscape(A4)

    # Background color
    c.setFillColor(HexColor("#f8f9fa"))
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # Border frame
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

    # User Name
    c.setFillColor(HexColor("#111827"))
    c.setFont("Helvetica-Bold", 40)
    c.drawCentredString(width / 2.0, height - 230, user_name.upper())

    # Text before course name
    c.setFillColor(HexColor("#4b5563"))
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2.0, height - 280, "has successfully completed the requirements for the course:")

    # Course Name
    c.setFillColor(HexColor("#2563eb"))
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width / 2.0, height - 340, course_name.upper())

    # Divider line
    c.setStrokeColor(HexColor("#d1d5db"))
    c.setLineWidth(1)
    c.line(width / 2.0 - 200, height - 380, width / 2.0 + 200, height - 380)

    # Verification Code & Date details
    c.setFillColor(HexColor("#6b7280"))
    c.setFont("Helvetica", 12)
    c.drawString(80, 80, f"Issued Date: {issue_date.strftime('%B %d, %Y')}")
    c.drawString(80, 60, f"Verification Code: {verification_code}")

    # Organizer Signature area
    c.setFont("Helvetica-Bold", 14)
    c.drawString(width - 250, 80, "ELITE COACH AI")
    c.setFont("Helvetica", 12)
    c.drawString(width - 250, 60, "Authorized Signature")
    
    c.save()

    return f"/static/certs/{filename}"
