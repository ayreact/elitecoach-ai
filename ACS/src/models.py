import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, Integer, DateTime, Text, JSON
from sqlalchemy import Column, String, Float, Boolean, Integer, DateTime, Text
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
    correct_answers = Column(JSON, nullable=False) # e.g. {"q1": "A", "q2": "C"}
    max_score = Column(Integer, default=100)
    pass_score = Column(Integer, default=70)
