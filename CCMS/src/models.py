from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .database import Base

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    domain = Column(String, index=True)
    difficulty_level = Column(String)
    skill_tags = Column(JSON) # Storing array of strings as JSON
    tutor_id = Column(String, index=True)
    published_at = Column(DateTime, nullable=True)

    modules = relationship("Module", back_populates="course", cascade="all, delete-orphan")

class Module(Base):
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    title = Column(String)
    order_index = Column(Integer)
    content_chunks = Column(JSON) # Array of objects representing chunk info
    assessment_id = Column(String, nullable=True)
    is_human_required = Column(Boolean, default=False)

    course = relationship("Course", back_populates="modules")

class AssessmentRubric(Base):
    __tablename__ = "assessment_rubrics"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(String, index=True, unique=True, nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), index=True)
    correct_answers = Column(JSON, nullable=False) # e.g. {"q1": "A", "q2": "C"}
    max_score = Column(Integer, default=100)
    pass_score = Column(Integer, default=70)
