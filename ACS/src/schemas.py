from pydantic import BaseModel, ConfigDict
from typing import Dict, Optional, Any
from datetime import datetime

class QuizSubmission(BaseModel):
    user_id: str
    assessment_id: str
    course_id: int
    answers: Dict[str, str]

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
