import pytest
from dotenv import load_dotenv
load_dotenv()
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import os

from src.main import app
from src.dependencies import get_current_user
from src.database import get_db, SessionLocal
from src.models import Course, Module, AssessmentRubric

client = TestClient(app)

# Authentication Mocks
def override_get_current_user_tutor():
    return {"id": "tutor_999", "role": "Tutor", "email": "tutor@test.com"}

def override_get_current_user_learner():
    return {"id": "learner_999", "role": "Learner", "email": "learner@test.com"}

# Set default to Tutor for most operations
app.dependency_overrides[get_current_user] = override_get_current_user_tutor

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="module", autouse=True)
def cleanup(db_session: Session):
    # Setup - nothing specific needed
    yield
    # Teardown - Delete the test course and associated data
    # Find test courses
    test_courses = db_session.query(Course).filter(Course.title == "Test Course: MVP Validation").all()
    for course in test_courses:
        # Rubrics don't cascade automatically in SQLAlchemy config, delete manually
        rubrics = db_session.query(AssessmentRubric).filter(AssessmentRubric.course_id == course.id).all()
        for rubric in rubrics:
            db_session.delete(rubric)
        # Modules should cascade, but let's be explicit just in case
        db_session.delete(course)
    
    db_session.commit()
    
    # Try to clean up Pinecone vectors
    try:
        from pinecone import Pinecone
        PINECONE_API_KEY = os.getenv("PINECONE_API")
        PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "elite-coach-index")
        if PINECONE_API_KEY:
            pc = Pinecone(api_key=PINECONE_API_KEY)
            index = pc.Index(PINECONE_INDEX_NAME)
            # Find the course IDs that were deleted to delete their vectors
            for course in test_courses:
                # We know the ID format is course_{id}_chunk_{idx}
                # To keep it simple, we just won't clean Pinecone here because Pinecone vector IDs 
                # were dynamically generated. We will clean it in the test itself since we know the course_id.
                pass
    except Exception as e:
        print(f"Failed to clean up Pinecone: {e}")


class TestCourseAPI:
    course_id = None
    assessment_id = "test_assess_1"

    def test_create_course_as_learner(self):
        app.dependency_overrides[get_current_user] = override_get_current_user_learner
        response = client.post(
            "/courses/",
            json={
                "title": "Test Course: MVP Validation",
                "description": "A test course",
                "domain": "Technology",
                "difficulty_level": "Beginner",
                "skill_tags": ["pytest", "fastapi"],
                "tutor_id": "tutor_999"
            }
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "Not authorized to create courses"
        
        # Revert to Tutor
        app.dependency_overrides[get_current_user] = override_get_current_user_tutor

    def test_create_course_as_tutor(self):
        response = client.post(
            "/courses/",
            json={
                "title": "Test Course: MVP Validation",
                "description": "A test course",
                "domain": "Technology",
                "difficulty_level": "Beginner",
                "skill_tags": ["pytest", "fastapi"],
                "tutor_id": "tutor_999"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Test Course: MVP Validation"
        assert "id" in data
        TestCourseAPI.course_id = data["id"]

    def test_get_courses(self):
        response = client.get("/courses/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        # Check if our test course is in the list
        assert any(course["id"] == TestCourseAPI.course_id for course in data)

    def test_create_module(self):
        assert TestCourseAPI.course_id is not None
        response = client.post(
            f"/courses/{TestCourseAPI.course_id}/modules",
            json={
                "title": "Module 1: Introduction to Testing",
                "order_index": 1,
                "content_chunks": [{"text": "Testing is important. It ensures software works as expected."}],
                "assessment_id": TestCourseAPI.assessment_id,
                "is_human_required": False
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Module 1: Introduction to Testing"

    def test_get_curriculum(self):
        response = client.get(f"/courses/{TestCourseAPI.course_id}/curriculum")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == TestCourseAPI.course_id
        assert len(data["modules"]) == 1
        assert data["modules"][0]["title"] == "Module 1: Introduction to Testing"

    def test_create_assessment_rubric(self):
        response = client.post(
            f"/courses/{TestCourseAPI.course_id}/assessments/{TestCourseAPI.assessment_id}/rubric",
            json={
                "assessment_id": TestCourseAPI.assessment_id,
                "course_id": TestCourseAPI.course_id,
                "correct_answers": {"q1": "A", "q2": "C"},
                "max_score": 100,
                "pass_score": 70
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["correct_answers"] == {"q1": "A", "q2": "C"}

    def test_create_duplicate_rubric(self):
        response = client.post(
            f"/courses/{TestCourseAPI.course_id}/assessments/{TestCourseAPI.assessment_id}/rubric",
            json={
                "assessment_id": TestCourseAPI.assessment_id,
                "course_id": TestCourseAPI.course_id,
                "correct_answers": {"q1": "B"},
            }
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Rubric already exists for this assessment"

    def test_internal_ingest(self):
        # This calls the real OpenAI and Pinecone API!
        response = client.post(f"/courses/internal/ingest?course_id={TestCourseAPI.course_id}")
        # The URL in main is just /courses/internal/ingest so it expects course_id as a query param
        
        # Wait, in the router it is defined as: @router.post("/internal/ingest")
        # And the function is def internal_ingest(course_id: int, ...):
        # By default in FastAPI this means course_id is a query parameter
        if response.status_code != 200:
            with open("error_out.txt", "w") as f:
                f.write(response.text)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "Successfully chunked and inserted" in data["message"]
        
        # Cleanup Pinecone
        try:
            from pinecone import Pinecone
            PINECONE_API_KEY = os.getenv("PINECONE_API")
            PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "elite-coach-index")
            if PINECONE_API_KEY:
                pc = Pinecone(api_key=PINECONE_API_KEY)
                index = pc.Index(PINECONE_INDEX_NAME)
                # We inserted 1 chunk in module 1
                index.delete(ids=[f"course_{TestCourseAPI.course_id}_chunk_0"])
        except Exception as e:
            print(f"Cleanup Pinecone failed: {e}")
