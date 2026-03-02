from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import httpx
import os

from app.services.bigquery_service import BigQueryService

router = APIRouter()
bq_service = BigQueryService()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

SYSTEM_PROMPT = """You are a SPAR-KG drug monitoring analyst assistant. You analyze drug-related content trends across social media platforms (Reddit, TikTok, YouTube).

Your role is to:
- Provide insights about drug mention trends across platforms
- Explain patterns, spikes, or notable changes in the data
- Compare drug mentions across different platforms
- Summarize behavioral patterns found in TikTok drug-related content
- Answer questions about specific drugs, categories, or platforms

Be concise, factual, and data-driven. When provided with data context, reference specific numbers and trends. If you don't have enough data to answer confidently, say so.

Keep responses under 200 words unless the user asks for more detail."""


class ChatRequest(BaseModel):
    question: str
    context: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    answer: str
    suggestions: List[str]


@router.post("/ask", response_model=ChatResponse)
async def ask_question(request: ChatRequest):
    """Send a question to the LLM with relevant data context."""
    try:
        # Build context from BigQuery data
        data_context = await _build_data_context(request.context or {})

        # Build messages for Ollama
        system_content = SYSTEM_PROMPT
        if data_context:
            system_content += f"\n\nHere is the current data context:\n{data_context}"

        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": request.question},
        ]

        # Call Ollama
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": OLLAMA_MODEL,
                    "messages": messages,
                    "stream": False,
                },
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail="LLM service returned an error. Ensure Ollama is running with `ollama serve`.",
                )

            result = response.json()
            answer = result.get("message", {}).get("content", "I couldn't generate a response.")

        # Generate follow-up suggestions
        suggestions = _generate_suggestions(request.question, request.context)

        return ChatResponse(answer=answer, suggestions=suggestions)

    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Cannot connect to Ollama. Please start it with `ollama serve`.",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="LLM request timed out. The model may be loading. Please try again.",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")


@router.get("/health")
async def chat_health():
    """Check if Ollama is reachable."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                model_names = [m.get("name", "") for m in models]
                return {
                    "status": "connected",
                    "model": OLLAMA_MODEL,
                    "available_models": model_names,
                }
        return {"status": "error", "detail": "Unexpected response from Ollama"}
    except Exception:
        return {"status": "disconnected", "detail": "Ollama is not running"}


async def _build_data_context(context: Dict[str, Any]) -> str:
    """Fetch relevant BigQuery data to give the LLM context."""
    parts = []

    try:
        # Always include top drugs summary
        top_drugs_query = """
        SELECT scientific_name, SUM(total_mentions) as mentions
        FROM (
            SELECT scientific_name, SUM(post_count) as total_mentions
            FROM sparkg_gold.weekly_drug_counts
            GROUP BY scientific_name
            UNION ALL
            SELECT scientific_name, SUM(video_count) as total_mentions
            FROM sparkg_gold.tiktok_daily_trends
            GROUP BY scientific_name
        )
        GROUP BY scientific_name
        ORDER BY mentions DESC
        LIMIT 10
        """
        top_drugs = bq_service.execute_query(top_drugs_query, max_results=10)
        if top_drugs:
            drug_list = ", ".join(
                f"{d['scientific_name']} ({d['mentions']} mentions)" for d in top_drugs
            )
            parts.append(f"Top drugs across platforms: {drug_list}")

        # If a specific drug is in context, get its stats
        drug = context.get("drug")
        if drug:
            drug_query = f"""
            SELECT
                (SELECT SUM(post_count) FROM sparkg_gold.weekly_drug_counts WHERE LOWER(scientific_name) = LOWER('{drug}')) as reddit_posts,
                (SELECT SUM(video_count) FROM sparkg_gold.tiktok_daily_trends WHERE LOWER(scientific_name) = LOWER('{drug}')) as tiktok_videos,
                (SELECT SUM(total_videos) FROM sparkg_gold.youtube_weekly_engagement WHERE LOWER(scientific_name) = LOWER('{drug}')) as youtube_videos
            """
            drug_stats = bq_service.execute_query(drug_query, max_results=1)
            if drug_stats:
                s = drug_stats[0]
                parts.append(
                    f"Stats for {drug}: Reddit posts={s.get('reddit_posts', 0)}, "
                    f"TikTok videos={s.get('tiktok_videos', 0)}, "
                    f"YouTube videos={s.get('youtube_videos', 0)}"
                )

        # If specific platform is in context
        platform = context.get("platform")
        if platform and platform != "all":
            platform_labels = {"reddit": "Reddit", "tiktok": "TikTok", "youtube": "YouTube"}
            parts.append(f"User is currently exploring: {platform_labels.get(platform, platform)}")

        # If there is inline data passed directly
        data = context.get("data")
        if data:
            parts.append(f"Data being viewed: {str(data)[:1000]}")

    except Exception:
        pass  # Don't fail the LLM call if context fetch fails

    return "\n".join(parts)


def _generate_suggestions(question: str, context: Optional[Dict[str, Any]]) -> List[str]:
    """Generate follow-up suggestion buttons based on the question."""
    suggestions = []
    q_lower = question.lower()

    if "trend" in q_lower or "spike" in q_lower:
        suggestions.append("Show me the data")
    if "compare" in q_lower:
        suggestions.append("View platform breakdown")
    if context and context.get("drug"):
        suggestions.append(f"View {context['drug']} posts")

    # Default suggestions
    if not suggestions:
        suggestions = ["Ask another question", "Explore drug trends", "View platform overview"]

    return suggestions[:3]
