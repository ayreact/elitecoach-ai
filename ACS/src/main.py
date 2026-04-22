import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routers import assessment
from .database import engine, Base, SessionLocal

logger = logging.getLogger(__name__)

# Ensure certs dir exists for local-dev fallback
os.makedirs("certs", exist_ok=True)

_DEFAULT_BENCHMARKS = [
    {"role_name": "Data Scientist",     "skill_targets": {"python": 80.0, "sql": 70.0, "machine_learning": 60.0}},
    {"role_name": "Product Manager",    "skill_targets": {"agile": 75.0, "communication": 85.0, "data_analysis": 65.0}},
    {"role_name": "Software Engineer",  "skill_targets": {"python": 75.0, "system_design": 70.0, "sql": 60.0}},
    {"role_name": "Finance Analyst",    "skill_targets": {"financial_modelling": 80.0, "excel": 75.0, "data_analysis": 65.0}},
    {"role_name": "Data Analyst",       "skill_targets": {"sql": 80.0, "data_analysis": 75.0, "python": 60.0}},
    {"role_name": "Business Analyst",   "skill_targets": {"data_analysis": 75.0, "communication": 80.0, "agile": 65.0}},
    {"role_name": "UX Designer",        "skill_targets": {"ux_research": 80.0, "prototyping": 75.0, "communication": 70.0}},
    {"role_name": "DevOps Engineer",    "skill_targets": {"system_design": 80.0, "python": 65.0, "sql": 50.0}},
    {"role_name": "Default",            "skill_targets": {"core_skills": 50.0}},
]


async def _seed_benchmarks():
    """
    Seeds default career benchmarks on startup if the table is empty.
    Ensures any target_role that Service B (AI Tutor Engine) supports
    has a matching skill-gap benchmark in Service D immediately.
    """
    if not SessionLocal:
        return
    from .models import CareerBenchmark
    db = SessionLocal()
    try:
        if db.query(CareerBenchmark).count() == 0:
            db.add_all([CareerBenchmark(**b) for b in _DEFAULT_BENCHMARKS])
            db.commit()
            logger.info(f"Seeded {len(_DEFAULT_BENCHMARKS)} default career benchmarks.")
    except Exception as e:
        logger.error(f"Failed to seed career benchmarks: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once on startup: create tables + seed benchmarks."""
    if engine:
        Base.metadata.create_all(bind=engine)
    await _seed_benchmarks()
    yield
    # (nothing to teardown)


app = FastAPI(
    title="Assessment & Certification Service",
    description=(
        "Service D for Elite Coach AI: Validates learning outcomes, "
        "updates the Skill Taxonomy, and issues verifiable credentials. "
        "Integrates with Service B (AI Tutor Engine) via /quiz/submit-inline."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Only serve certs locally — in production Cloudinary CDN is used
_cloudinary_configured = all([
    os.getenv("CLOUDINARY_CLOUD_NAME"),
    os.getenv("CLOUDINARY_API_KEY"),
    os.getenv("CLOUDINARY_API_SECRET"),
])
if not _cloudinary_configured:
    app.mount("/static/certs", StaticFiles(directory="certs"), name="certs")

app.include_router(assessment.router, prefix="/v1/assessment", tags=["Assessment"])


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Assessment & Certification Service",
        "storage": "cloudinary" if _cloudinary_configured else "local_disk",
    }
