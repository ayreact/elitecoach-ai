import uuid
from typing import Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import validate_user
from ..models import AssessmentResult, Certificate, LearnerProfile, AssessmentRubric
from ..schemas import QuizSubmission, AssessmentResultResponse, CertificateResponse, StatsResponse
from ..pdf_generator import generate_certificate_pdf

router = APIRouter()

@router.post("/quiz/submit", response_model=AssessmentResultResponse)
def submit_quiz_score(
    payload: QuizSubmission, 
    db: Session = Depends(get_db), 
    user: dict = Depends(validate_user)
):
    """
    Evaluates user answers against a database rubric, scores the assessment, 
    and updates the user's skill_scores JSON in the LearnerProfile.
    """
    # Enforce token identity matches payload identity
    if str(user.get("id")) != str(payload.user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Cannot submit quiz for another user."
        )

    # Fetch the rubric
    rubric = db.query(AssessmentRubric).filter(
        AssessmentRubric.assessment_id == payload.assessment_id,
        AssessmentRubric.course_id == payload.course_id
    ).first()

    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Assessment rubric not found."
        )

    # Score assessment
    total_questions = len(rubric.correct_answers)
    if total_questions == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Rubric has no correct answers defined."
        )

    correct_count = 0
    for q_id, correct_ans in rubric.correct_answers.items():
        user_ans = payload.answers.get(q_id)
        if user_ans == correct_ans:
            correct_count += 1
            
    score = (correct_count / total_questions) * rubric.max_score
    passed = score >= rubric.pass_score

    # Construct the result record
    previous_attempts = db.query(AssessmentResult).filter(
        AssessmentResult.user_id == payload.user_id,
        AssessmentResult.assessment_id == payload.assessment_id
    ).count()

    result = AssessmentResult(
        user_id=payload.user_id,
        assessment_id=payload.assessment_id,
        course_id=payload.course_id,
        score=score,
        passed=passed,
        attempt_no=previous_attempts + 1
    )
    
    db.add(result)

    # Update LearnerProfile
    profile = db.query(LearnerProfile).filter(LearnerProfile.user_id == payload.user_id).first()
    if not profile:
        profile = LearnerProfile(user_id=payload.user_id, skill_scores={})
        db.add(profile)
    
    # Simple logic to increment skill_scores if passed (can be made more sophisticated with domain mapping)
    if passed:
        current_scores = dict(profile.skill_scores) if profile.skill_scores else {}
        domain_key = f"course_{payload.course_id}_domain"
        current_scores[domain_key] = current_scores.get(domain_key, 0.0) + score
        profile.skill_scores = current_scores

        # Optionally adjust learning velocity (mock calculation for logic structure)
        profile.learning_velocity += 1.5

    db.commit()
    db.refresh(result)
    return result


@router.get("/certificates/{uid}", response_model=CertificateResponse)
def get_certificate(
    uid: str, 
    course_id: int,
    db: Session = Depends(get_db), 
    user: dict = Depends(validate_user)
):
    """
    Generates or fetches a unique digital certificate (with a verification code) 
    once a final course exam is passed. 
    Note: uid can be the verification code or certificate id. Here we search by course and user,
    or directly via verification_code if specified.
    """
    auth_user_id = str(user.get("id"))
    
    # Verify if learner has passed the assessment representing the final course exam
    # (Assuming there's a final assessment mapped out in the DB, for generic purposes we 
    # check for ANY passing assessment for this course_id)
    passed_exam = db.query(AssessmentResult).filter(
        AssessmentResult.user_id == auth_user_id,
        AssessmentResult.course_id == course_id,
        AssessmentResult.passed == True
    ).first()

    if not passed_exam:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="User has not passed the required final exam for this course."
        )
    
    # Check if certificate already exists
    cert = db.query(Certificate).filter(
        Certificate.user_id == auth_user_id,
        Certificate.course_id == course_id
    ).first()

    if not cert:
        # Generate new certificate
        verification_code = f"EC-{uuid.uuid4().hex[:8].upper()}"
        
        # Get user info for PDF (fallback to ID if name is missing)
        user_name = user.get("name") or user.get("full_name") or f"Learner {auth_user_id[:6]}"
        course_name_display = f"Course {course_id}" # Ideally fetched from a Course db model
        
        # Generate the PDF file via ReportLab
        issued_date = datetime.now()
        pdf_url = generate_certificate_pdf(
            user_name=user_name,
            course_name=course_name_display,
            verification_code=verification_code,
            issue_date=issued_date
        )
        
        cert = Certificate(
            user_id=auth_user_id,
            course_id=course_id,
            verification_code=verification_code,
            pdf_url=pdf_url,
            issued_at=issued_date
        )
        db.add(cert)
        db.commit()
        db.refresh(cert)

    return cert


@router.get("/stats/skill-gap", response_model=StatsResponse)
def get_skill_gap_stats(
    db: Session = Depends(get_db), 
    user: dict = Depends(validate_user)
):
    """
    Calculates and returns the user’s learning progress/velocity against their career goal.
    """
    auth_user_id = str(user.get("id"))
    
    profile = db.query(LearnerProfile).filter(LearnerProfile.user_id == auth_user_id).first()
    
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learner profile not found.")

    career_benchmarks = {
        "Data Scientist": {"python": 80.0, "sql": 70.0, "machine_learning": 60.0},
        "Product Manager": {"agile": 75.0, "communication": 85.0, "data_analysis": 65.0},
        "Default": {"core_skills": 50.0}
    }

    goal = profile.career_goal or "Default"
    target_benchmarks = career_benchmarks.get(goal, career_benchmarks["Default"])

    skill_gap_analysis = {}
    user_scores = profile.skill_scores or {}

    for skill, target in target_benchmarks.items():
        current_val = user_scores.get(skill, 0.0)
        gap = target - current_val
        skill_gap_analysis[skill] = {
            "current": current_val,
            "target": target,
            "gap": round(max(0, gap), 2),
            "status": "proficient" if gap <= 0 else "needs_improvement"
        }

    return StatsResponse(
        career_goal=goal,
        skill_gap_analysis=skill_gap_analysis,
        learning_velocity=profile.learning_velocity
    )
