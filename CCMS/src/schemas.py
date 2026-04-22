from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class ModuleBase(BaseModel):
    title: str
    order_index: int
    content_chunks: Optional[List[Dict[str, Any]]] = []
    assessment_id: Optional[str] = None
    is_human_required: bool = False

class ModuleCreate(ModuleBase):
    pass

class ModuleResponse(ModuleBase):
    id: int
    course_id: int

    class Config:
        from_attributes = True

class CourseBase(BaseModel):
    title: str
    description: Optional[str] = None
    domain: str
    difficulty_level: str
    skill_tags: List[str] = []
    tutor_id: str

class CourseCreate(CourseBase):
    pass

class CourseResponse(CourseBase):
    id: int
    published_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CourseCurriculumResponse(CourseResponse):
    modules: List[ModuleResponse] = []

class AssessmentRubricBase(BaseModel):
    assessment_id: str
    course_id: int
    correct_answers: Dict[str, Any]
    max_score: int = 100
    pass_score: int = 70

class AssessmentRubricCreate(AssessmentRubricBase):
    pass

class AssessmentRubricResponse(AssessmentRubricBase):
    id: int

    class Config:
        from_attributes = True
