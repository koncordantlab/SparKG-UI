from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.services.ranking_service import RankingService

router = APIRouter()
ranking_service = RankingService()


@router.get("/posts")
async def get_all_posts(
    drug: Optional[str] = None,
    rank_min: Optional[int] = None,
    rank_max: Optional[int] = None,
    annotated: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    offset: int = 0,
):
    try:
        return ranking_service.get_all_posts(drug=drug, rank_min=rank_min, rank_max=rank_max, annotated=annotated, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_ranking_summary():
    try:
        return ranking_service.get_summary_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drugs")
async def get_ranking_drugs():
    try:
        return ranking_service.get_drugs()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/queries")
async def get_ranking_queries(
    drug: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
):
    try:
        return ranking_service.get_queries(drug=drug, search=search, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/queries/{query_id}/posts")
async def get_query_posts(
    query_id: str,
    limit: int = Query(default=20, le=100),
    offset: int = 0,
):
    try:
        return ranking_service.get_query_posts(query_id=query_id, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/relevance-distribution")
async def get_relevance_distribution(drug: Optional[str] = None):
    try:
        return ranking_service.get_relevance_distribution(drug=drug)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/precision")
async def get_precision_at_k(
    k: int = Query(default=10, ge=1, le=100),
    drug: Optional[str] = None,
    threshold: int = Query(default=2, ge=0, le=3),
):
    try:
        return ranking_service.compute_precision_at_k(k=k, drug=drug, threshold=threshold)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/ndcg")
async def get_ndcg_at_k(
    k: int = Query(default=10, ge=1, le=100),
    drug: Optional[str] = None,
):
    try:
        return ranking_service.compute_ndcg_at_k(k=k, drug=drug)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
