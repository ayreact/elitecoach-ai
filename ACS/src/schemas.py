from pydantic import BaseModel, ConfigDict
from typing import Dict, List, Optional, Any
from datetime import datetime


# ---------------------------------------------------------------------------
# Quiz submission schemas
# ---------------------------------------------------------------------------

class QuizSubmission(BaseModel):
    """Rubric-based quiz submission — Service D looks up correct answers from its DB."""
    user_id: str
    assessment_id: str
    course_id: int
    answers: Dict[str, str]  # {question_id: learner_answer}


class InlineQuestion(BaseModel):
    """A single question from Service B's quiz generator."""
    id: str           # question identifier, e.g. "q1"
    correct_answer: str


class InlineQuizSubmission(BaseModel):
    """
    Inline quiz submission — bridges Service B's quiz format with Service D.
    Used when Service B generates a quiz: correct answers are passed directly
    (never sent to the browser; the frontend calls this server-to-server or
    the backend orchestrates it). Service D grades, stores the result, and
    updates the LearnerProfile — same as the rubric-based flow.
    """
    user_id: str
    course_id: int
    skill_domain: Optional[str] = None   # e.g. "python", "sql" — for skill_scores key
    questions: List[InlineQuestion]       # questions + correct answers from Service B
    submitted_answers: Dict[str, str]     # {question_id: learner_answer}
    max_score: int = 100
    pass_score: int = 70
    # Optional: pass Service B's integer assessment_id for cross-service traceability
    tutor_assessment_id: Optional[int] = None


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class AssessmentResultResponse(BaseModel):
    id: str
    user_id: str
    assessment_id: str
    course_id: int
    score: float
    passed: bool
    attempt_no: int
    completed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CertificateResponse(BaseModel):
    id: str
    user_id: str
    course_id: int
    issued_at: datetime
    verification_code: str
    pdf_url: str
    co_brand_org_id: Optional[str] = None
    # Computed by the router — one-click LinkedIn share URL for this certificate
    linkedin_share_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PublicCertificateResponse(BaseModel):
    """
    Safe public view of a certificate — returned by the no-auth verify endpoint.
    Does NOT include user_id or any PII beyond course and issue date.
    """
    verification_code: str
    course_id: int
    issued_at: datetime
    pdf_url: str
    co_brand_org_id: Optional[str] = None
    is_valid: bool = True

    model_config = ConfigDict(from_attributes=True)


class LearnerProfileResponse(BaseModel):
    id: str
    user_id: str
    career_goal: Optional[str] = None
    skill_scores: Dict[str, float]
    learning_velocity: float
    weekly_time_hrs: float
    last_diagnostic_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class StatsResponse(BaseModel):
    career_goal: Optional[str]
    skill_gap_analysis: Dict[str, Any]
    learning_velocity: float


# ---------------------------------------------------------------------------
# Profile update schema (syncs with Service B's learning path)
# ---------------------------------------------------------------------------

class ProfileUpdateRequest(BaseModel):
    """
    Called by the frontend (or Service B via webhook) after a learning path
    update to keep Service D's LearnerProfile in sync.
    Both fields are optional — only provided fields are updated.
    """
    career_goal: Optional[str] = None    # maps to Service B's target_role / new_goal
    weekly_time_hrs: Optional[float] = None  # maps to Service B's time_per_week


# ---------------------------------------------------------------------------
# Career benchmark schemas (Conflict #5 fix — dynamic role support)
# ---------------------------------------------------------------------------

class BenchmarkCreateRequest(BaseModel):
    """
    Adds or updates a career benchmark. Allows any target_role from Service B
    to get meaningful skill-gap analysis without a code redeploy.
    """
    role_name: str                         # must match Service B's target_role value exactly
    skill_targets: Dict[str, float]        # e.g. {"python": 80.0, "sql": 70.0}


class BenchmarkResponse(BaseModel):
    id: int
    role_name: str
    skill_targets: Dict[str, float]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
