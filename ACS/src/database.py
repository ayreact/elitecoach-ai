import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import logging

load_dotenv()  # Ensure .env is loaded before reading env vars

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    logger.warning("DATABASE_URL environment variable is not set. Database connections will fail.")
    # For robust failure modes, we don't crash at startup but when DB is requested.
    engine = None
    SessionLocal = None
else:
    try:
        # Supabase specific configurations and pool pooling can be added here
        engine = create_engine(
            DATABASE_URL, 
            # pool_size=5, 
            # max_overflow=10,
            # pool_recycle=1800
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    except Exception as e:
        logger.error(f"Failed to initialize database engine: {e}")
        engine = None
        SessionLocal = None

Base = declarative_base()

def get_db():
    if not SessionLocal:
        raise RuntimeError("Database not configured. Check DATABASE_URL.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
