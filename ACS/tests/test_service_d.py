"""
Elite Coach AI — Service D (Assessment & Certification Service)
MVP Production Test Suite

Tests ALL endpoints against the real Supabase DB with mocked Identity Service JWT.
Each test represents a real user interaction with the production system.

Run: pytest tests/test_service_d.py -v --tb=short
"""
import uuid
import pytest
from dotenv import load_dotenv
load_dotenv()

from fastapi.testclient import TestClient
from src.main import app
from src.dependencies import validate_user
from src.database import SessionLocal
from src.models import AssessmentRubric, AssessmentResult, Certificate, LearnerProfile, CareerBenchmark

# ── Unique test identity (won't clash with real data) ─────────────────────────
_RUN = uuid.uuid4().hex[:10]
TEST_USER_ID      = f"mvptest-{_RUN}"
TEST_COURSE_ID    = 88888           # high ID unlikely to collide with real courses
TEST_COURSE_ID_2  = 88889           # for inline-quiz tests
TEST_ASSESSMENT_ID = f"rubric-{_RUN}"

TEST_USER = {
    "id":    TEST_USER_ID,
    "email": f"test-{_RUN}@elitecoach.ai",
    "name":  f"MVP Test Runner",
    "phone": "+2348099000000",
    "role":  "learner",
}

# Shared context — populated by tests as they progress (mirrors real user flow)
ctx: dict = {}


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client():
    """Single TestClient for the whole session; JWT is mocked to TEST_USER."""
    app.dependency_overrides[validate_user] = lambda: TEST_USER
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="session")
def db():
    s = SessionLocal()
    yield s
    s.close()


@pytest.fixture(scope="session", autouse=True)
def provision_and_teardown(db):
    """Seed a real AssessmentRubric; clean up ALL test data after the run."""
    from sqlalchemy import text
    
    # ── Setup: Insert test courses to satisfy FKs ──
    db.execute(text("INSERT INTO courses (id, title) VALUES (:id1, 'Test Course 1') ON CONFLICT (id) DO NOTHING"), {"id1": TEST_COURSE_ID})
    db.execute(text("INSERT INTO courses (id, title) VALUES (:id2, 'Test Course 2') ON CONFLICT (id) DO NOTHING"), {"id2": TEST_COURSE_ID_2})
    db.commit()

    rubric = AssessmentRubric(
        assessment_id=TEST_ASSESSMENT_ID,
        course_id=TEST_COURSE_ID,
        correct_answers={"q1": "A", "q2": "B", "q3": "C", "q4": "D", "q5": "A"},
        max_score=100,
        pass_score=60,
        skill_domain="python",
    )
    db.add(rubric)
    db.commit()
    yield
    # ── Teardown: delete all test rows from Supabase ──
    db.query(Certificate).filter(Certificate.user_id == TEST_USER_ID).delete()
    db.query(AssessmentResult).filter(AssessmentResult.user_id == TEST_USER_ID).delete()
    db.query(LearnerProfile).filter(LearnerProfile.user_id == TEST_USER_ID).delete()
    db.query(AssessmentRubric).filter(AssessmentRubric.assessment_id == TEST_ASSESSMENT_ID).delete()
    db.query(CareerBenchmark).filter(CareerBenchmark.role_name == "ML Engineer").delete()
    db.execute(text("DELETE FROM courses WHERE id IN (:id1, :id2)"), {"id1": TEST_COURSE_ID, "id2": TEST_COURSE_ID_2})
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# 1. HEALTH & INFRASTRUCTURE
# ═══════════════════════════════════════════════════════════════════════════════

def test_01_health_check(client):
    """Service must be up, reporting correct service name and storage mode."""
    r = client.get("/health")
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "ok"
    assert "Assessment" in d["service"]
    assert d["storage"] in ("cloudinary", "local_disk")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. AUTHENTICATION GUARD
# ═══════════════════════════════════════════════════════════════════════════════

def test_02_protected_endpoints_reject_missing_auth():
    """Every protected endpoint must return 401 when no Authorization header is sent."""
    protected = [
        ("POST",  "/v1/assessment/quiz/submit",
         {"user_id": "x", "assessment_id": "x", "course_id": 1, "answers": {}}),
        ("POST",  "/v1/assessment/quiz/submit-inline",
         {"user_id": "x", "course_id": 1, "questions": [], "submitted_answers": {}}),
        ("GET",   "/v1/assessment/certificates/", None),
        ("GET",   f"/v1/assessment/certificates/{TEST_USER_ID}?course_id=1", None),
        ("PATCH", "/v1/assessment/profile", {"career_goal": "x"}),
        ("GET",   "/v1/assessment/stats/skill-gap", None),
        ("POST",  "/v1/assessment/benchmarks",
         {"role_name": "x", "skill_targets": {"x": 1.0}}),
    ]
    old_overrides = app.dependency_overrides.copy()
    app.dependency_overrides.clear()
    try:
        with TestClient(app) as bare:
            for method, path, body in protected:
                r = getattr(bare, method.lower())(path, json=body) if body else getattr(bare, method.lower())(path)
                assert r.status_code == 401, f"Expected 401 on {method} {path}, got {r.status_code}: {r.text}"
    finally:
        app.dependency_overrides.update(old_overrides)


# ═══════════════════════════════════════════════════════════════════════════════
# 3. PUBLIC ENDPOINTS (no auth required)
# ═══════════════════════════════════════════════════════════════════════════════

def test_03_benchmarks_public_and_seeded(client):
    """GET /benchmarks is public and must return all seeded career benchmarks."""
    r = client.get("/v1/assessment/benchmarks")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 4
    roles = {b["role_name"] for b in data}
    for expected in ("Data Scientist", "Product Manager", "Software Engineer", "Finance Analyst"):
        assert expected in roles, f"Missing seeded benchmark: {expected}"


def test_04_public_verify_invalid_code_returns_404():
    """Public /verify/{code} must return 404 for non-existent codes, no auth needed."""
    with TestClient(app) as bare:
        r = bare.get("/v1/assessment/certificates/verify/INVALID-FAKE-CODE-99999")
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# 4. DYNAMIC BENCHMARKS (Conflict #5 fix — any Service B target_role supported)
# ═══════════════════════════════════════════════════════════════════════════════

def test_05_create_custom_benchmark(client):
    """POST /benchmarks must persist a new career role that Service B might introduce."""
    r = client.post("/v1/assessment/benchmarks", json={
        "role_name": "ML Engineer",
        "skill_targets": {"machine_learning": 90.0, "python": 85.0, "statistics": 70.0}
    })
    assert r.status_code == 201
    d = r.json()
    assert d["role_name"] == "ML Engineer"
    assert d["skill_targets"]["machine_learning"] == 90.0


def test_06_upsert_existing_benchmark(client):
    """POST /benchmarks on an existing role must update it (upsert, not duplicate)."""
    r = client.post("/v1/assessment/benchmarks", json={
        "role_name": "ML Engineer",
        "skill_targets": {"machine_learning": 95.0, "python": 85.0}
    })
    assert r.status_code == 201
    assert r.json()["skill_targets"]["machine_learning"] == 95.0
    # Verify no duplicate
    all_r = client.get("/v1/assessment/benchmarks")
    names = [b["role_name"] for b in all_r.json()]
    assert names.count("ML Engineer") == 1


# ═══════════════════════════════════════════════════════════════════════════════
# 5. LEARNER PROFILE (Conflict #4 fix — syncs with Service B learning paths)
# ═══════════════════════════════════════════════════════════════════════════════

def test_07_update_profile_career_goal(client, db):
    """PATCH /profile must create LearnerProfile and set career_goal."""
    r = client.patch("/v1/assessment/profile", json={
        "career_goal": "Data Scientist",
        "weekly_time_hrs": 10.0
    })
    assert r.status_code == 200
    d = r.json()
    assert "career_goal" in d["updated"]
    assert "weekly_time_hrs" in d["updated"]
    # Verify persisted in Supabase
    profile = db.query(LearnerProfile).filter(LearnerProfile.user_id == TEST_USER_ID).first()
    assert profile is not None
    assert profile.career_goal == "Data Scientist"
    assert profile.weekly_time_hrs == 10.0


def test_08_skill_gap_reflects_career_goal(client):
    """GET /stats/skill-gap must return benchmarks for the set career goal."""
    r = client.get("/v1/assessment/stats/skill-gap")
    assert r.status_code == 200
    d = r.json()
    assert d["career_goal"] == "Data Scientist"
    assert "python" in d["skill_gap_analysis"]
    assert "sql" in d["skill_gap_analysis"]
    assert "machine_learning" in d["skill_gap_analysis"]
    # All gaps should be at target initially (no quiz passed yet for these skills)
    for skill, info in d["skill_gap_analysis"].items():
        assert info["status"] == "needs_improvement"


# ═══════════════════════════════════════════════════════════════════════════════
# 6. RUBRIC-BASED QUIZ SUBMIT
# ═══════════════════════════════════════════════════════════════════════════════

def test_09_quiz_submit_wrong_user_id_rejected(client):
    """POST /quiz/submit must reject payloads where user_id doesn't match JWT."""
    r = client.post("/v1/assessment/quiz/submit", json={
        "user_id": "some-other-user-id",
        "assessment_id": TEST_ASSESSMENT_ID,
        "course_id": TEST_COURSE_ID,
        "answers": {"q1": "A"}
    })
    assert r.status_code == 403


def test_10_quiz_submit_missing_rubric_returns_404(client):
    """POST /quiz/submit with non-existent assessment_id must return 404."""
    r = client.post("/v1/assessment/quiz/submit", json={
        "user_id": TEST_USER_ID,
        "assessment_id": "non-existent-rubric-xyz",
        "course_id": TEST_COURSE_ID,
        "answers": {"q1": "A"}
    })
    assert r.status_code == 404


def test_11_quiz_submit_fail_case(client, db):
    """POST /quiz/submit with all wrong answers must score 0% and mark passed=False."""
    r = client.post("/v1/assessment/quiz/submit", json={
        "user_id": TEST_USER_ID,
        "assessment_id": TEST_ASSESSMENT_ID,
        "course_id": TEST_COURSE_ID,
        "answers": {"q1": "D", "q2": "D", "q3": "D", "q4": "A", "q5": "D"}
    })
    assert r.status_code == 200
    d = r.json()
    assert d["passed"] is False
    assert d["score"] == 0.0
    assert d["attempt_no"] == 1
    ctx["first_result_id"] = d["id"]


def test_12_quiz_submit_pass_case(client, db):
    """POST /quiz/submit with all correct answers must score 100% and mark passed=True."""
    r = client.post("/v1/assessment/quiz/submit", json={
        "user_id": TEST_USER_ID,
        "assessment_id": TEST_ASSESSMENT_ID,
        "course_id": TEST_COURSE_ID,
        "answers": {"q1": "A", "q2": "B", "q3": "C", "q4": "D", "q5": "A"}
    })
    assert r.status_code == 200
    d = r.json()
    assert d["passed"] is True
    assert d["score"] == 100.0
    assert d["attempt_no"] == 2      # second attempt
    assert d["user_id"] == TEST_USER_ID
    assert d["course_id"] == TEST_COURSE_ID
    ctx["passing_result_id"] = d["id"]


def test_13_skill_scores_updated_after_pass(client, db):
    """After passing, LearnerProfile.skill_scores['python'] must be > 0."""
    db.expire_all()
    profile = db.query(LearnerProfile).filter(LearnerProfile.user_id == TEST_USER_ID).first()
    assert profile is not None
    assert profile.skill_scores.get("python", 0) > 0
    assert profile.learning_velocity > 0


def test_14_skill_gap_reduced_after_pass(client):
    """After passing python quiz, python skill gap must decrease."""
    r = client.get("/v1/assessment/stats/skill-gap")
    assert r.status_code == 200
    d = r.json()
    python_info = d["skill_gap_analysis"]["python"]
    assert python_info["current"] > 0
    # Gap should be less than target (80.0) after passing with 100
    assert python_info["gap"] == 0.0 or python_info["status"] == "proficient"


# ═══════════════════════════════════════════════════════════════════════════════
# 7. CERTIFICATE GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

def test_15_cert_not_issued_before_passing(client):
    """GET /certificates/{uid} for a course with no passing result must return 400."""
    r = client.get(f"/v1/assessment/certificates/{TEST_USER_ID}?course_id=77777")
    assert r.status_code == 400


def test_16_cert_wrong_uid_rejected(client):
    """GET /certificates/{uid} where uid != JWT user must return 403."""
    r = client.get(f"/v1/assessment/certificates/some-other-user?course_id={TEST_COURSE_ID}")
    assert r.status_code == 403


def test_17_cert_generated_after_pass(client, db):
    """GET /certificates/{uid} after passing must generate a PDF and return cert with LinkedIn URL."""
    r = client.get(f"/v1/assessment/certificates/{TEST_USER_ID}?course_id={TEST_COURSE_ID}")
    assert r.status_code == 200
    d = r.json()
    assert d["user_id"] == TEST_USER_ID
    assert d["course_id"] == TEST_COURSE_ID
    assert d["verification_code"].startswith("EC-")
    assert d["pdf_url"] is not None and len(d["pdf_url"]) > 0
    assert d["linkedin_share_url"] is not None
    assert "linkedin.com/shareArticle" in d["linkedin_share_url"]
    assert d["verification_code"] in d["linkedin_share_url"]
    ctx["verification_code"] = d["verification_code"]
    ctx["pdf_url"] = d["pdf_url"]


def test_18_cert_not_duplicated_on_second_request(client, db):
    """Calling GET /certificates/{uid} again must return the SAME cert, not a new one."""
    r = client.get(f"/v1/assessment/certificates/{TEST_USER_ID}?course_id={TEST_COURSE_ID}")
    assert r.status_code == 200
    d = r.json()
    assert d["verification_code"] == ctx["verification_code"]
    # Verify only one cert row in DB
    count = db.query(Certificate).filter(
        Certificate.user_id == TEST_USER_ID,
        Certificate.course_id == TEST_COURSE_ID
    ).count()
    assert count == 1


def test_19_list_certificates(client):
    """GET /certificates/ must return a list containing the issued certificate."""
    r = client.get("/v1/assessment/certificates/")
    assert r.status_code == 200
    certs = r.json()
    assert isinstance(certs, list)
    assert len(certs) >= 1
    codes = [c["verification_code"] for c in certs]
    assert ctx["verification_code"] in codes
    # All certs must have LinkedIn URL
    for c in certs:
        assert c["linkedin_share_url"] is not None


def test_20_public_certificate_verification(client):
    """GET /certificates/verify/{code} must be publicly accessible and return cert data."""
    code = ctx["verification_code"]
    with TestClient(app) as bare:   # No JWT override — truly public request
        r = bare.get(f"/v1/assessment/certificates/verify/{code}")
    assert r.status_code == 200
    d = r.json()
    assert d["verification_code"] == code
    assert d["is_valid"] is True
    assert d["course_id"] == TEST_COURSE_ID
    assert "user_id" not in d   # must NOT expose PII


def test_21_public_verify_invalid_code(client):
    """Public verify must return 404 for codes that don't exist."""
    with TestClient(app) as bare:
        r = bare.get("/v1/assessment/certificates/verify/EC-FAKECODE")
    assert r.status_code == 404


def test_22_pdf_url_is_accessible(client):
    """PDF URL must be a valid URL (Cloudinary CDN or local static path)."""
    url = ctx.get("pdf_url", "")
    assert url.startswith("http") or url.startswith("/static/certs/")
    if url.startswith("http"):
        assert "cloudinary" in url or "res.cloudinary" in url


# ═══════════════════════════════════════════════════════════════════════════════
# 8. INLINE QUIZ SUBMIT (Service B Bridge — Conflicts #1, #2, #3)
# ═══════════════════════════════════════════════════════════════════════════════

def test_23_inline_quiz_wrong_user_rejected(client):
    """POST /quiz/submit-inline must reject if user_id doesn't match JWT."""
    r = client.post("/v1/assessment/quiz/submit-inline", json={
        "user_id": "another-user",
        "course_id": TEST_COURSE_ID_2,
        "questions": [{"id": "q1", "correct_answer": "A"}],
        "submitted_answers": {"q1": "A"}
    })
    assert r.status_code == 403


def test_24_inline_quiz_empty_questions_rejected(client):
    """POST /quiz/submit-inline with no questions must return 400."""
    r = client.post("/v1/assessment/quiz/submit-inline", json={
        "user_id": TEST_USER_ID,
        "course_id": TEST_COURSE_ID_2,
        "questions": [],
        "submitted_answers": {}
    })
    assert r.status_code == 400


def test_25_inline_quiz_fail_case(client):
    """POST /quiz/submit-inline with all wrong answers must return passed=False."""
    r = client.post("/v1/assessment/quiz/submit-inline", json={
        "user_id": TEST_USER_ID,
        "course_id": TEST_COURSE_ID_2,
        "skill_domain": "sql",
        "questions": [
            {"id": "q1", "correct_answer": "A"},
            {"id": "q2", "correct_answer": "B"},
            {"id": "q3", "correct_answer": "C"},
        ],
        "submitted_answers": {"q1": "D", "q2": "D", "q3": "D"},
        "max_score": 100,
        "pass_score": 60
    })
    assert r.status_code == 200
    d = r.json()
    assert d["passed"] is False
    assert d["score"] == 0.0
    assert d["course_id"] == TEST_COURSE_ID_2


def test_26_inline_quiz_pass_case(client, db):
    """POST /quiz/submit-inline with correct answers must return passed=True and update skill_scores."""
    r = client.post("/v1/assessment/quiz/submit-inline", json={
        "user_id": TEST_USER_ID,
        "course_id": TEST_COURSE_ID_2,
        "skill_domain": "sql",
        "questions": [
            {"id": "q1", "correct_answer": "A"},
            {"id": "q2", "correct_answer": "B"},
            {"id": "q3", "correct_answer": "C"},
        ],
        "submitted_answers": {"q1": "A", "q2": "B", "q3": "C"},
        "max_score": 100,
        "pass_score": 60
    })
    assert r.status_code == 200
    d = r.json()
    assert d["passed"] is True
    assert d["score"] == 100.0
    # Verify result stored in real DB
    result = db.query(AssessmentResult).filter(AssessmentResult.id == d["id"]).first()
    assert result is not None
    assert result.passed is True


def test_27_inline_quiz_tutor_assessment_id_traced(client):
    """POST /quiz/submit-inline with tutor_assessment_id must embed it in the assessment_id."""
    r = client.post("/v1/assessment/quiz/submit-inline", json={
        "user_id": TEST_USER_ID,
        "course_id": TEST_COURSE_ID_2,
        "questions": [{"id": "q1", "correct_answer": "A"}],
        "submitted_answers": {"q1": "A"},
        "tutor_assessment_id": 42
    })
    assert r.status_code == 200
    d = r.json()
    assert d["assessment_id"].startswith("tutor-42-")


def test_28_inline_quiz_attempt_counter_increments(client):
    """Repeated inline submissions for same course must increment attempt_no."""
    r = client.post("/v1/assessment/quiz/submit-inline", json={
        "user_id": TEST_USER_ID,
        "course_id": TEST_COURSE_ID_2,
        "questions": [{"id": "q1", "correct_answer": "A"}],
        "submitted_answers": {"q1": "A"},
    })
    assert r.status_code == 200
    # attempt_no should be > 1 now (we've submitted multiple times for this course)
    assert r.json()["attempt_no"] >= 2


# ═══════════════════════════════════════════════════════════════════════════════
# 9. PROFILE SYNC (Conflict #4 — career goal sync with Service B)
# ═══════════════════════════════════════════════════════════════════════════════

def test_29_profile_update_career_goal_syncs_skill_gap(client):
    """Updating career_goal to custom role must immediately reflect in skill-gap analysis."""
    # Update to custom benchmark added in test_05
    r = client.patch("/v1/assessment/profile", json={"career_goal": "ML Engineer"})
    assert r.status_code == 200
    # Skill gap must now use ML Engineer benchmarks from DB
    r2 = client.get("/v1/assessment/stats/skill-gap")
    assert r2.status_code == 200
    d = r2.json()
    assert d["career_goal"] == "ML Engineer"
    assert "machine_learning" in d["skill_gap_analysis"]


def test_30_profile_partial_update_only_changes_specified_fields(client, db):
    """PATCH /profile with only one field must not overwrite other fields."""
    client.patch("/v1/assessment/profile", json={"career_goal": "Data Scientist"})
    # Now only update weekly_time_hrs
    r = client.patch("/v1/assessment/profile", json={"weekly_time_hrs": 20.0})
    assert r.status_code == 200
    assert r.json()["updated"] == ["weekly_time_hrs"]
    db.expire_all()
    profile = db.query(LearnerProfile).filter(LearnerProfile.user_id == TEST_USER_ID).first()
    assert profile.career_goal == "Data Scientist"   # unchanged
    assert profile.weekly_time_hrs == 20.0


# ═══════════════════════════════════════════════════════════════════════════════
# 10. DATA INTEGRITY
# ═══════════════════════════════════════════════════════════════════════════════

def test_31_assessment_results_persisted_correctly(client, db):
    """All submitted quiz results must be stored correctly in Supabase."""
    results = db.query(AssessmentResult).filter(
        AssessmentResult.user_id == TEST_USER_ID
    ).all()
    assert len(results) >= 4   # fail, pass (rubric) + fail, pass (inline) + tutor + extra
    passed = [r for r in results if r.passed]
    failed = [r for r in results if not r.passed]
    assert len(passed) >= 2
    assert len(failed) >= 2
    for result in results:
        assert result.completed_at is not None
        assert result.score >= 0
        assert result.attempt_no >= 1


def test_32_learner_profile_skill_scores_correct(client, db):
    """LearnerProfile must have skill_scores for both python and sql after passing both quizzes."""
    db.expire_all()
    profile = db.query(LearnerProfile).filter(LearnerProfile.user_id == TEST_USER_ID).first()
    assert profile.skill_scores.get("python", 0) > 0
    assert profile.skill_scores.get("sql", 0) > 0
    assert profile.learning_velocity > 0


def test_33_certificate_stored_with_correct_fields(client, db):
    """Certificate row in Supabase must have all required fields from the spec."""
    cert = db.query(Certificate).filter(
        Certificate.user_id == TEST_USER_ID,
        Certificate.course_id == TEST_COURSE_ID
    ).first()
    assert cert is not None
    assert cert.verification_code.startswith("EC-")
    assert len(cert.verification_code) == 11   # EC- + 8 hex chars
    assert cert.pdf_url is not None
    assert cert.issued_at is not None
