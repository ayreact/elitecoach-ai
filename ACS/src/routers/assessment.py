import uuid
import os
import logging
from urllib.parse import quote
from typing import List, Any
from datetime import datetime

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import validate_user
from ..models import AssessmentResult, Certificate, LearnerProfile, AssessmentRubric, CareerBenchmark
from ..schemas import (
    QuizSubmission,
    InlineQuizSubmission,
    AssessmentResultResponse,
    CertificateResponse,
    PublicCertificateResponse,
    StatsResponse,
    ProfileUpdateRequest,
    BenchmarkCreateRequest,
    BenchmarkResponse,
)
from ..pdf_generator import generate_certificate_pdf

router = APIRouter()
logger = logging.getLogger(__name__)

PLATFORM_BASE_URL = os.getenv("PLATFORM_BASE_URL", "http://localhost:8000")
ENGAGEMENT_SERVICE_URL = os.getenv("ENGAGEMENT_SERVICE_URL", "")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_linkedin_share_url(verification_code: str) -> str:
    cert_url = f"{PLATFORM_BASE_URL}/v1/assessment/certificates/verify/{verification_code}"
    title = quote("Certificate of Completion — Elite Coach AI", safe="")
    summary = quote("I just earned a certified credential on Elite Coach AI!", safe="")
    return (
        f"https://www.linkedin.com/shareArticle?mini=true"
        f"&url={quote(cert_url, safe='')}"
        f"&title={title}"
        f"&summary={summary}"
        f"&source=EliteCoachAI"
    )


def _enrich_cert(cert: Certificate) -> CertificateResponse:
    response = CertificateResponse.model_validate(cert)
    response.linkedin_share_url = _build_linkedin_share_url(cert.verification_code)
    return response


def _get_or_create_profile(db: Session, user_id: str) -> LearnerProfile:
    profile = db.query(LearnerProfile).filter(LearnerProfile.user_id == user_id).first()
    if not profile:
        profile = LearnerProfile(user_id=user_id, skill_scores={})
        db.add(profile)
    return profile


def _apply_skill_score(profile: LearnerProfile, domain_key: str, score: float) -> None:
    """Updates skill_scores on the learner profile after a passed assessment."""
    current_scores = dict(profile.skill_scores) if profile.skill_scores else {}
    current_scores[domain_key] = round(current_scores.get(domain_key, 0.0) + score, 2)
    profile.skill_scores = current_scores
    profile.learning_velocity = round(profile.learning_velocity + 1.5, 2)


async def _notify_engagement(user_id: str, course_id: int, score: float, assessment_id: str) -> None:
    """
    Fire-and-forget async notification to the Engagement Service (Service G).
    Called via BackgroundTasks so it never blocks the quiz submit response.
    Resolves Conflict #7 — no async event on quiz pass.
    """
    if not ENGAGEMENT_SERVICE_URL:
        return
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                ENGAGEMENT_SERVICE_URL,
                json={
                    "event": "quiz_passed",
                    "user_id": user_id,
                    "course_id": course_id,
                    "score": score,
                    "assessment_id": assessment_id,
                },
            )
    except Exception as e:
        logger.warning(f"Engagement service notification failed (non-blocking): {e}")


def _get_benchmark_targets(db: Session, goal: str) -> dict:
    """
    Returns skill targets for a career goal.
    Checks DB first (supports any role from Service B), then falls back to
    an internal default map, then to a generic "Default" entry.
    Resolves Conflict #5 — free-text roles from Service B had no matching benchmarks.
    """
    db_benchmark = db.query(CareerBenchmark).filter(CareerBenchmark.role_name == goal).first()
    if db_benchmark:
        return db_benchmark.skill_targets

    # Internal fallback for roles not yet in DB (seeding may not have run yet)
    _fallback = {
        "Data Scientist": {"python": 80.0, "sql": 70.0, "machine_learning": 60.0},
        "Product Manager": {"agile": 75.0, "communication": 85.0, "data_analysis": 65.0},
        "Software Engineer": {"python": 75.0, "system_design": 70.0, "sql": 60.0},
        "Finance Analyst": {"financial_modelling": 80.0, "excel": 75.0, "data_analysis": 65.0},
        "Default": {"core_skills": 50.0},
    }
    return _fallback.get(goal, _fallback["Default"])


# ---------------------------------------------------------------------------
# POST /quiz/submit  — rubric-based (original endpoint, unchanged behaviour)
# ---------------------------------------------------------------------------

@router.post("/quiz/submit", response_model=AssessmentResultResponse)
async def submit_quiz_score(
    payload: QuizSubmission,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: dict = Depends(validate_user),
):
    """
    Rubric-based quiz grading. Service D looks up the AssessmentRubric in its
    own DB. Used for quizzes that were pre-registered via the CMS (Service C).
    """
    if str(user.get("id")) != str(payload.user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot submit quiz for another user.")

    rubric = db.query(AssessmentRubric).filter(
        AssessmentRubric.assessment_id == payload.assessment_id,
        AssessmentRubric.course_id == payload.course_id,
    ).first()
    if not rubric:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment rubric not found.")
    if not rubric.correct_answers:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Rubric has no correct answers defined.")

    total = len(rubric.correct_answers)
    correct = sum(1 for q, ans in rubric.correct_answers.items() if payload.answers.get(q) == ans)
    score = (correct / total) * rubric.max_score
    passed = score >= rubric.pass_score

    previous = db.query(AssessmentResult).filter(
        AssessmentResult.user_id == payload.user_id,
        AssessmentResult.assessment_id == payload.assessment_id,
    ).count()

    result = AssessmentResult(
        user_id=payload.user_id,
        assessment_id=payload.assessment_id,
        course_id=payload.course_id,
        score=score,
        passed=passed,
        attempt_no=previous + 1,
    )
    db.add(result)

    profile = _get_or_create_profile(db, payload.user_id)
    if passed:
        domain_key = rubric.skill_domain or f"course_{payload.course_id}_domain"
        _apply_skill_score(profile, domain_key, score)
        background_tasks.add_task(_notify_engagement, payload.user_id, payload.course_id, score, result.id)

    db.commit()
    db.refresh(result)
    return result


# ---------------------------------------------------------------------------
# POST /quiz/submit-inline  — Service B bridge (Conflicts #1, #2, #3 fix)
# ---------------------------------------------------------------------------

@router.post("/quiz/submit-inline", response_model=AssessmentResultResponse)
async def submit_inline_quiz(
    payload: InlineQuizSubmission,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: dict = Depends(validate_user),
):
    """
    Inline quiz grading — bridges Service B (AI Tutor Engine) with Service D.

    Resolves Conflicts #1, #2, #3:
    - Service B generates quizzes via POST /api/v1/assessments/generate-quiz
    - Instead of submitting to Service B's /assessments/submit (which never updates
      Service D's DB), the frontend calls THIS endpoint with the correct answers
      (from Service B's quiz data) and the learner's submitted answers.
    - Service D grades inline, stores the AssessmentResult, updates LearnerProfile,
      and fires the engagement event — keeping the full certification pipeline intact.
    - A UUID assessment_id is generated internally so Service D's int vs string
      mismatch with Service B is sidestepped entirely (Conflict #3).
    - tutor_assessment_id (Service B's integer ID) is stored for traceability.
    """
    if str(user.get("id")) != str(payload.user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot submit quiz for another user.")

    if not payload.questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No questions provided.")

    # Build correct answers map from questions list
    correct_answers = {q.id: q.correct_answer for q in payload.questions}
    total = len(correct_answers)
    correct = sum(1 for q_id, ans in correct_answers.items() if payload.submitted_answers.get(q_id) == ans)
    score = (correct / total) * payload.max_score
    passed = score >= payload.pass_score

    # Generate a Service D UUID for this assessment.
    # Prefix with tutor_assessment_id for traceability if provided.
    if payload.tutor_assessment_id is not None:
        assessment_id = f"tutor-{payload.tutor_assessment_id}-{uuid.uuid4().hex[:8]}"
    else:
        assessment_id = str(uuid.uuid4())

    previous = db.query(AssessmentResult).filter(
        AssessmentResult.user_id == payload.user_id,
        AssessmentResult.course_id == payload.course_id,
    ).count()

    result = AssessmentResult(
        user_id=payload.user_id,
        assessment_id=assessment_id,
        course_id=payload.course_id,
        score=score,
        passed=passed,
        attempt_no=previous + 1,
    )
    db.add(result)

    profile = _get_or_create_profile(db, payload.user_id)
    if passed:
        domain_key = payload.skill_domain or f"course_{payload.course_id}_domain"
        _apply_skill_score(profile, domain_key, score)
        background_tasks.add_task(_notify_engagement, payload.user_id, payload.course_id, score, result.id)

    db.commit()
    db.refresh(result)
    return result


# ---------------------------------------------------------------------------
# GET /certificates/  — list all certificates for authenticated user
# ---------------------------------------------------------------------------

@router.get("/certificates/", response_model=List[CertificateResponse])
async def list_my_certificates(
    db: Session = Depends(get_db),
    user: dict = Depends(validate_user),
):
    auth_user_id = str(user.get("id"))
    certs = db.query(Certificate).filter(Certificate.user_id == auth_user_id).all()
    return [_enrich_cert(c) for c in certs]


# ---------------------------------------------------------------------------
# GET /certificates/verify/{code}  — PUBLIC, no auth required
# ---------------------------------------------------------------------------

@router.get("/certificates/verify/{code}", response_model=PublicCertificateResponse)
async def verify_certificate(code: str, db: Session = Depends(get_db)):
    """
    Public verification endpoint. No JWT required.
    Used by enterprises, universities, and LinkedIn to confirm a certificate is genuine.
    """
    cert = db.query(Certificate).filter(Certificate.verification_code == code).first()
    if not cert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No certificate found with code '{code}'.")
    return PublicCertificateResponse(
        verification_code=cert.verification_code,
        course_id=cert.course_id,
        issued_at=cert.issued_at,
        pdf_url=cert.pdf_url,
        co_brand_org_id=cert.co_brand_org_id,
        is_valid=True,
    )


# ---------------------------------------------------------------------------
# GET /certificates/{uid}  — get or generate certificate for a specific course
# ---------------------------------------------------------------------------

@router.get("/certificates/{uid}", response_model=CertificateResponse)
async def get_certificate(
    uid: str,
    course_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(validate_user),
):
    """
    Generates or fetches the digital certificate for the authenticated user for
    a specific course. uid is the user_id and must match the JWT identity.
    """
    auth_user_id = str(user.get("id"))
    if uid != auth_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only retrieve your own certificates.")

    passed_exam = db.query(AssessmentResult).filter(
        AssessmentResult.user_id == auth_user_id,
        AssessmentResult.course_id == course_id,
        AssessmentResult.passed == True,
    ).first()
    if not passed_exam:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has not passed the required final exam for this course.")

    cert = db.query(Certificate).filter(
        Certificate.user_id == auth_user_id,
        Certificate.course_id == course_id,
    ).first()

    if not cert:
        verification_code = f"EC-{uuid.uuid4().hex[:8].upper()}"
        user_name = user.get("name") or user.get("full_name") or f"Learner {auth_user_id[:6]}"
        issued_date = datetime.now()
        pdf_url = generate_certificate_pdf(
            user_name=user_name,
            course_name=f"Course {course_id}",
            verification_code=verification_code,
            issue_date=issued_date,
        )
        cert = Certificate(
            user_id=auth_user_id,
            course_id=course_id,
            verification_code=verification_code,
            pdf_url=pdf_url,
            issued_at=issued_date,
        )
        db.add(cert)
        db.commit()
        db.refresh(cert)

    return _enrich_cert(cert)


# ---------------------------------------------------------------------------
# PATCH /profile  — sync career goal from Service B's learning path
# (Conflict #4 fix — split-brain career goal)
# ---------------------------------------------------------------------------

@router.patch("/profile", response_model=dict)
async def update_learner_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(validate_user),
):
    """
    Updates the authenticated user's LearnerProfile in Service D.

    Resolves Conflict #4: When Service B updates a learner's learning path
    (PUT /api/v1/learning/paths/{user_id}), the frontend should also call
    this endpoint to keep Service D's career_goal and weekly_time_hrs in sync,
    so that /stats/skill-gap always reflects the current goal.
    """
    auth_user_id = str(user.get("id"))
    profile = _get_or_create_profile(db, auth_user_id)

    updated_fields = []
    if payload.career_goal is not None:
        profile.career_goal = payload.career_goal
        updated_fields.append("career_goal")
    if payload.weekly_time_hrs is not None:
        profile.weekly_time_hrs = payload.weekly_time_hrs
        updated_fields.append("weekly_time_hrs")

    db.commit()
    return {"updated": updated_fields, "user_id": auth_user_id}


# ---------------------------------------------------------------------------
# GET /stats/skill-gap
# ---------------------------------------------------------------------------

@router.get("/stats/skill-gap", response_model=StatsResponse)
async def get_skill_gap_stats(
    db: Session = Depends(get_db),
    user: dict = Depends(validate_user),
):
    """
    Calculates the user's learning progress against benchmarks for their career goal.
    Resolves Conflict #5: benchmarks are now DB-backed, so any target_role from
    Service B is supported without a code redeploy.
    """
    auth_user_id = str(user.get("id"))
    profile = db.query(LearnerProfile).filter(LearnerProfile.user_id == auth_user_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learner profile not found.")

    goal = profile.career_goal or "Default"
    target_benchmarks = _get_benchmark_targets(db, goal)
    user_scores = profile.skill_scores or {}

    skill_gap_analysis: dict[str, Any] = {}
    for skill, target in target_benchmarks.items():
        current_val = float(user_scores.get(skill, 0.0))
        gap = target - current_val
        skill_gap_analysis[skill] = {
            "current": round(current_val, 2),
            "target": target,
            "gap": round(max(0.0, gap), 2),
            "status": "proficient" if gap <= 0 else "needs_improvement",
        }

    return StatsResponse(
        career_goal=goal,
        skill_gap_analysis=skill_gap_analysis,
        learning_velocity=profile.learning_velocity,
    )


# ---------------------------------------------------------------------------
# GET /benchmarks  — list all career benchmarks
# POST /benchmarks — add or update a benchmark
# (Conflict #5 fix — dynamic role support from Service B)
# ---------------------------------------------------------------------------

@router.get("/benchmarks", response_model=List[BenchmarkResponse])
async def list_benchmarks(db: Session = Depends(get_db)):
    """Lists all available career benchmarks. Public — no auth required."""
    return db.query(CareerBenchmark).all()


@router.post("/benchmarks", response_model=BenchmarkResponse, status_code=status.HTTP_201_CREATED)
async def upsert_benchmark(
    payload: BenchmarkCreateRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(validate_user),
):
    """
    Add or update a career benchmark.
    Call this whenever Service B introduces a new target_role value so that
    /stats/skill-gap can return meaningful data for that role immediately.
    Auth required (admin action — verify role enforcement at API gateway level).
    """
    existing = db.query(CareerBenchmark).filter(CareerBenchmark.role_name == payload.role_name).first()
    if existing:
        existing.skill_targets = payload.skill_targets
        db.commit()
        db.refresh(existing)
        return existing

    benchmark = CareerBenchmark(role_name=payload.role_name, skill_targets=payload.skill_targets)
    db.add(benchmark)
    db.commit()
    db.refresh(benchmark)
    return benchmark
