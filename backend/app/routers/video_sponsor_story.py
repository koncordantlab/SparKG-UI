import json
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

router = APIRouter()

DATA_FILE = Path(__file__).parent.parent.parent / "Yihong" / "video_sponsor_story_map.jsonl"

_story_map: dict[str, dict] = {}

def _load():
    if _story_map:
        return
    if not DATA_FILE.exists():
        return
    with open(DATA_FILE) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                vid = record.get("video", {}).get("video_id") or record.get("summary_columns", {}).get("video_id")
                if vid:
                    _story_map[str(vid)] = record
            except json.JSONDecodeError:
                continue

_load()


def _get_record(video_id: str) -> dict:
    record = _story_map.get(str(video_id))
    if not record:
        raise HTTPException(status_code=404, detail=f"No sponsor story found for video_id={video_id}")
    return record


# Static routes MUST come before /{video_id} to avoid being matched as a path param

@router.get("/video-sponsor-story")
def list_stories(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    all_records = list(_story_map.values())
    page = all_records[offset: offset + limit]
    return {
        "total": len(_story_map),
        "records": page,
    }


@router.get("/video-sponsor-story/reviewer-table")
def reviewer_table(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    all_records = list(_story_map.values())
    page = all_records[offset: offset + limit]
    rows = [r.get("summary_columns", {}) for r in page]
    return {
        "total": len(_story_map),
        "rows": rows,
    }


@router.post("/video-sponsor-story/summaries")
def get_summaries(body: dict):
    video_ids = body.get("video_ids", [])
    results = []
    for vid in video_ids:
        record = _story_map.get(str(vid))
        if record:
            results.append(record.get("summary_columns", {}))
    return results


@router.get("/video-sponsor-story/{video_id}")
def get_story(video_id: str):
    return _get_record(video_id)


@router.get("/video-sponsor-story/{video_id}/trace")
def get_trace(video_id: str):
    record = _get_record(video_id)
    return {
        "video_id": video_id,
        "pipeline_stages": record.get("pipeline_stages", []),
        "retrieval_provenance": record.get("retrieval_provenance"),
        "text_evidence": record.get("text_evidence"),
        "completeness": record.get("completeness"),
    }


@router.get("/video-sponsor-story/{video_id}/education")
def get_education(video_id: str):
    record = _get_record(video_id)
    edu = record.get("education_session") or {}
    BLOCKED_KEYWORDS = {"dosing", "preparation", "sourcing", "synthesis", "how to use", "how to make"}

    recommendations = edu.get("recommendations") or edu.get("actions") or []
    safe_recs = []
    for rec in recommendations:
        # Never show items that require human review before display
        if rec.get("requires_human_review_before_showing"):
            continue
        title = (rec.get("resource_title") or rec.get("title") or "").lower()
        summary = (rec.get("safe_summary") or rec.get("content") or "").lower()
        if any(kw in title or kw in summary for kw in BLOCKED_KEYWORDS):
            continue
        safe_recs.append(rec)

    return {
        "video_id": video_id,
        "education_session": {**edu, "recommendations": safe_recs},
        "sponsor_education_message": record.get("sponsor_explanation", {}).get("education_message"),
    }
