from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import courses

# Create all database tables (SQLite local dev)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Service C: Content & Curriculum Service",
    description="Manages the knowledge base, course materials, and vector search.",
    version="1.0.0",
)

# Optional CORS middleware setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the routers
app.include_router(courses.router)

@app.get("/health")
def health_check():
    """
    Standard health check endpoint for container orchestrators.
    """
    return {"status": "ok", "service": "content-curriculum"}
