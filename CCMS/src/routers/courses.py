from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os

from .. import models, schemas
from ..database import get_db
from ..dependencies import get_current_user

# Environment setup for Pinecone and OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API")
PINECONE_API_KEY = os.getenv("PINECONE_API")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "elite-coach-index")

router = APIRouter(
    prefix="/courses",
    tags=["Courses"],
)

@router.get("/", response_model=List[schemas.CourseResponse])
def get_courses(
    domain: Optional[str] = None,
    difficulty_level: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Lists available courses based on user eligibility and content filters.
    """
    query = db.query(models.Course)
    if domain:
        query = query.filter(models.Course.domain.ilike(f"%{domain}%"))
    if difficulty_level:
        query = query.filter(models.Course.difficulty_level.ilike(difficulty_level))
    
    courses = query.all()
    return courses

@router.post("/", response_model=schemas.CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    CMS creation logic for tutors.
    """
    if current_user.get("role") not in ["Tutor", "Super Admin", "Organisation Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to create courses")
    
    db_course = models.Course(**course.model_dump())
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    return db_course

@router.get("/{course_id}/curriculum", response_model=schemas.CourseCurriculumResponse)
def get_course_curriculum(course_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Returns the full structure (modules/lessons) of a course.
    """
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

@router.post("/{course_id}/modules", response_model=schemas.ModuleResponse, status_code=status.HTTP_201_CREATED)
def create_module(course_id: int, module: schemas.ModuleCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Adds a new module to an existing course.
    """
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    db_module = models.Module(**module.model_dump(), course_id=course_id)
    db.add(db_module)
    db.commit()
    db.refresh(db_module)
    return db_module

@router.post("/{course_id}/assessments/{assessment_id}/rubric", response_model=schemas.AssessmentRubricResponse, status_code=status.HTTP_201_CREATED)
def create_assessment_rubric(course_id: int, assessment_id: str, rubric: schemas.AssessmentRubricCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Creates an AssessmentRubric containing the correct answers for an assessment.
    Service D will use this map to grade learner submissions.
    """
    if current_user.get("role") not in ["Tutor", "Super Admin", "Organisation Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to create rubrics")

    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    # Verify module has this assessment
    module = db.query(models.Module).filter(models.Module.course_id == course_id, models.Module.assessment_id == assessment_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Assessment ID not found in this course")

    # Check if rubric already exists
    existing = db.query(models.AssessmentRubric).filter(models.AssessmentRubric.assessment_id == assessment_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Rubric already exists for this assessment")

    # Override path variables to ensure consistency
    rubric_data = rubric.model_dump()
    rubric_data["course_id"] = course_id
    rubric_data["assessment_id"] = assessment_id
    
    db_rubric = models.AssessmentRubric(**rubric_data)
    
    db.add(db_rubric)
    db.commit()
    db.refresh(db_rubric)
    return db_rubric


@router.post("/internal/ingest")
def internal_ingest(course_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Chunks and embeds new course data into the vector store.
    """
    # Verify course exists
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    if not OPENAI_API_KEY or not PINECONE_API_KEY:
        raise HTTPException(
            status_code=500, 
            detail="OPENAI_API and PINECONE_API must be set in the .env file for real ingestion."
        )

    try:
        # Import SDKs only when executing the real pipeline
        from openai import OpenAI
        from pinecone import Pinecone
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        
        # 1. Gather all course content
        modules = db.query(models.Module).filter(models.Module.course_id == course_id).order_by(models.Module.order_index).all()
        if not modules:
            return {"status": "skipped", "message": "No modules found for this course to chunk."}
            
        full_text = f"Course: {course.title}. Domain: {course.domain}. Difficulty: {course.difficulty_level}.\n\n"
        for mod in modules:
            full_text += f"Module {mod.order_index}: {mod.title}\n"
            if mod.content_chunks:
                for chunk in mod.content_chunks:
                    if isinstance(chunk, dict) and "text" in chunk:
                        full_text += chunk["text"] + "\n"
                    elif isinstance(chunk, str):
                        full_text += chunk + "\n"
            full_text += "\n"

        # 2. Text Splitting Engine via LangChain
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        chunks = text_splitter.split_text(full_text)
        
        if not chunks:
            return {"status": "skipped", "message": "No text could be extracted from course modules."}

        # Initialize API clients
        pc = Pinecone(api_key=PINECONE_API_KEY)
        client = OpenAI(api_key=OPENAI_API_KEY)
        
        # Connect to Pinecone index
        index = pc.Index(PINECONE_INDEX_NAME)
        
        # 3. Generate Embeddings via OpenAI
        response = client.embeddings.create(
            input=chunks,
            model="text-embedding-3-small"
        )
        embeddings = [data.embedding for data in response.data]
        
        # 4. Insert vectors into Pinecone
        vectors = []
        for idx, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            vectors.append({
                "id": f"course_{course_id}_chunk_{idx}",
                "values": embedding,
                "metadata": {"course_id": course_id, "text": chunk_text}
            })
            
        index.upsert(vectors=vectors)
        
        return {
            "status": "success",
            "message": f"Successfully chunked and inserted {len(chunks)} embeddings for course {course_id} into Pinecone index {PINECONE_INDEX_NAME}."
        }
        
    except ImportError:
        raise HTTPException(
            status_code=500, 
            detail="Missing dependencies for integration. Please run: pip install openai pinecone-client langchain-text-splitters"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
