from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()

from app.routers import bigquery, dashboard, chat, ranking

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
app.include_router(ranking.router, prefix="/api/v1/ranking", tags=["ranking"])


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
