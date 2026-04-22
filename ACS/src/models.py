import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, Integer, DateTime, JSON
from sqlalchemy.dialects.postgresql import JSONB

from .database import Base


def generate_uuid():
    return str(uuid.uuid4())


class AssessmentResult(Base):
    __tablename__ = "assessment_results"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, index=True, nullable=False)
    assessment_id = Column(String, index=True, nullable=False)
    course_id = Column(Integer, index=True, nullable=False)
    score = Column(Float, nullable=False)
    passed = Column(Boolean, nullable=False)
    attempt_no = Column(Integer, nullable=False, default=1)
    completed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, index=True, nullable=False)
    course_id = Column(Integer, index=True, nullable=False)
    issued_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    verification_code = Column(String, unique=True, index=True, nullable=False)
    pdf_url = Column(String, nullable=False)
    co_brand_org_id = Column(String, nullable=True)


class LearnerProfile(Base):
    __tablename__ = "learner_profiles"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, unique=True, index=True, nullable=False)
    career_goal = Column(String, nullable=True)
    skill_scores = Column(JSONB, nullable=False, default=dict)
    learning_velocity = Column(Float, nullable=False, default=0.0)
    weekly_time_hrs = Column(Float, nullable=False, default=0.0)
    last_diagnostic_at = Column(DateTime(timezone=True), nullable=True)


class AssessmentRubric(Base):
    __tablename__ = "assessment_rubrics"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(String, unique=True, index=True, nullable=False)
    course_id = Column(Integer, index=True, nullable=False)
    correct_answers = Column(JSON, nullable=False)  # e.g. {"q1": "A", "q2": "C"}
    max_score = Column(Integer, default=100)
    pass_score = Column(Integer, default=70)
    # Maps this assessment to a skill taxonomy key (e.g. "python", "sql")
    # Used to correctly update the learner's skill_scores after passing.
    skill_domain = Column(String, nullable=True)


class CareerBenchmark(Base):
    """
    DB-backed career benchmarks — allows any role from Service B's learning path
    generator to have a matching skill-gap analysis without hardcoding.
    Pre-seeded with defaults on startup; extensible via POST /v1/assessment/benchmarks.
    """
    __tablename__ = "career_benchmarks"

    id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String, unique=True, index=True, nullable=False)
    # e.g. {"python": 80.0, "sql": 70.0, "machine_learning": 60.0}
    skill_targets = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
