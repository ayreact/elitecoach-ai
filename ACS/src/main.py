from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from .routers import assessment
from .database import engine, Base

# Mount certs directory if not exists
os.makedirs("certs", exist_ok=True)

# Create tables if they don't exist
Base.metadata.create_all(bind=engine) if engine else None

app = FastAPI(
    title="Assessment & Certification Service",
    description="Service D for Elite Coach AI: Validates learning outcomes, updates the Skill Taxonomy, and issues credentials.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static/certs", StaticFiles(directory="certs"), name="certs")

app.include_router(assessment.router, prefix="/v1/assessment", tags=["Assessment"])

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Assessment & Certification Service"}
