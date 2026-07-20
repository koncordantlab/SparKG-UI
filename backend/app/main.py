from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()

from app.routers import bigquery, dashboard, chat, education
try:
    from app.routers import ranking
except ImportError:
    ranking = None
try:
    from app.routers import video_sponsor_story
except ImportError:
    video_sponsor_story = None

app = FastAPI(
    title="SparKG Dashboard API",
    description="API for drug monitoring dashboard - BigQuery data visualization",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bigquery.router, prefix="/api/v1", tags=["bigquery"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(education.router, prefix="/api/v1/education", tags=["education"])
if ranking:
    app.include_router(ranking.router, prefix="/api/v1/ranking", tags=["ranking"])
if video_sponsor_story:
    app.include_router(video_sponsor_story.router, prefix="/api/v1/dashboard/tiktok", tags=["sponsor-story"])

_edu_dir = Path(__file__).parent.parent / "Education"
if _edu_dir.exists():
    app.mount("/education-files", StaticFiles(directory=str(_edu_dir)), name="education-files")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
