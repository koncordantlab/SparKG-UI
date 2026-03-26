import json
import math
from pathlib import Path
from typing import Optional

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "ranking"


def _extract_tiktok_id(doc_id: str) -> str:
    """Extract numeric TikTok ID from doc_id format 'tiktok:7580...'"""
    if doc_id.startswith("tiktok:"):
        return doc_id[7:]
    return doc_id


# --- Load data at module level (once on startup) ---

_posts_raw: list[dict] = []
_posts_path = DATA_DIR / "top_posts_tiktok.json"
if _posts_path.exists():
    with open(_posts_path) as f:
        _posts_raw = json.load(f)

_annotations_raw: list[dict] = []
_annotations_path = DATA_DIR / "gpt_annotations_1000.jsonl"
if _annotations_path.exists():
    with open(_annotations_path) as f:
        for line in f:
            line = line.strip()
            if line:
                _annotations_raw.append(json.loads(line))

_eval_metrics: dict = {}
_eval_path = DATA_DIR / "tiktok_eval_metrics.json"
if _eval_path.exists():
    with open(_eval_path) as f:
        _eval_metrics = json.load(f)

# --- Build indexes ---

_annotations_by_id: dict[str, dict] = {}
for ann in _annotations_raw:
    _annotations_by_id[ann["tiktok_id"]] = ann

_posts_by_query: dict[str, list[dict]] = {}
for post in _posts_raw:
    qid = post["query_id"]
    if qid not in _posts_by_query:
        _posts_by_query[qid] = []
    _posts_by_query[qid].append(post)

for qid in _posts_by_query:
    _posts_by_query[qid].sort(key=lambda p: p["rank"])

_unique_drugs: list[str] = sorted(set(
    p["anchor_canon"] for p in _posts_raw if p.get("anchor_canon")
))

_query_metadata: dict[str, dict] = {}
for post in _posts_raw:
    qid = post["query_id"]
    if qid not in _query_metadata:
        _query_metadata[qid] = {
            "query_id": qid,
            "query_text": post.get("query_text", ""),
            "anchor_canon": post.get("anchor_canon", ""),
            "doc_count": 0,
            "annotated_count": 0,
        }
    _query_metadata[qid]["doc_count"] += 1
    tiktok_id = _extract_tiktok_id(post["doc_id"])
    if tiktok_id in _annotations_by_id:
        _query_metadata[qid]["annotated_count"] += 1


class RankingService:

    def get_all_posts(
        self,
        drug: Optional[str] = None,
        rank_min: Optional[int] = None,
        rank_max: Optional[int] = None,
        annotated: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict:
        posts = _posts_raw
        if drug:
            posts = [p for p in posts if p.get("anchor_canon") == drug]
        if rank_min is not None:
            posts = [p for p in posts if p["rank"] >= rank_min]
        if rank_max is not None:
            posts = [p for p in posts if p["rank"] <= rank_max]
        if annotated == "yes":
            posts = [p for p in posts if _extract_tiktok_id(p["doc_id"]) in _annotations_by_id]
        elif annotated == "no":
            posts = [p for p in posts if _extract_tiktok_id(p["doc_id"]) not in _annotations_by_id]
        total = len(posts)
        page = posts[offset: offset + limit]

        enriched = []
        for post in page:
            tiktok_id = _extract_tiktok_id(post["doc_id"])
            ann = _annotations_by_id.get(tiktok_id)
            enriched.append({
                "doc_id": post["doc_id"],
                "rank": post["rank"],
                "lambdamart_score": post["lambdamart_score"],
                "anchor_canon": post.get("anchor_canon", ""),
                "query_text": post.get("query_text", ""),
                "detected_drugs": post.get("detected_drugs", ""),
                "relevance": ann["relevance"] if ann else None,
                "confidence": ann["confidence"] if ann else None,
                "reasoning_short": ann["reasoning_short"] if ann else None,
            })

        return {"posts": enriched, "total": total}

    def get_summary_stats(self) -> dict:
        annotated_in_ranking = set()
        for post in _posts_raw:
            tid = _extract_tiktok_id(post["doc_id"])
            if tid in _annotations_by_id:
                annotated_in_ranking.add(tid)
        return {
            "total_ranked_posts": len(_posts_raw),
            "unique_queries": len(_posts_by_query),
            "total_annotations": len(_annotations_raw),
            "annotated_posts_in_ranking": len(annotated_in_ranking),
            "unique_drugs": len(_unique_drugs),
            "eval_metrics": _eval_metrics,
        }

    def get_drugs(self) -> list[str]:
        return _unique_drugs

    def get_queries(
        self,
        drug: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        queries = list(_query_metadata.values())
        if drug:
            queries = [q for q in queries if q["anchor_canon"] == drug]
        if search:
            search_lower = search.lower()
            queries = [
                q for q in queries
                if search_lower in q["query_text"].lower()
                or search_lower in q["query_id"].lower()
            ]
        total = len(queries)
        queries = queries[offset: offset + limit]
        return {"queries": queries, "total": total}

    def get_query_posts(
        self,
        query_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> dict:
        posts = _posts_by_query.get(query_id, [])
        total = len(posts)
        page = posts[offset: offset + limit]

        enriched = []
        for post in page:
            tiktok_id = _extract_tiktok_id(post["doc_id"])
            ann = _annotations_by_id.get(tiktok_id)
            enriched.append({
                "doc_id": post["doc_id"],
                "rank": post["rank"],
                "lambdamart_score": post["lambdamart_score"],
                "anchor_canon": post.get("anchor_canon", ""),
                "query_text": post.get("query_text", ""),
                "detected_drugs": post.get("detected_drugs", ""),
                "relevance": ann["relevance"] if ann else None,
                "confidence": ann["confidence"] if ann else None,
                "reasoning_short": ann["reasoning_short"] if ann else None,
            })

        return {"posts": enriched, "total": total, "query_id": query_id}

    def get_relevance_distribution(self, drug: Optional[str] = None) -> dict:
        distribution = {0: 0, 1: 0, 2: 0, 3: 0}
        unannotated = 0

        posts = _posts_raw
        if drug:
            posts = [p for p in posts if p.get("anchor_canon") == drug]

        seen_ids: set[str] = set()
        for post in posts:
            tiktok_id = _extract_tiktok_id(post["doc_id"])
            if tiktok_id in seen_ids:
                continue
            seen_ids.add(tiktok_id)
            ann = _annotations_by_id.get(tiktok_id)
            if ann:
                rel = ann["relevance"]
                if rel in distribution:
                    distribution[rel] += 1
            else:
                unannotated += 1

        return {
            "distribution": distribution,
            "unannotated": unannotated,
            "total_unique_posts": len(seen_ids),
        }

    def compute_precision_at_k(
        self,
        k: int = 10,
        drug: Optional[str] = None,
        threshold: int = 2,
    ) -> dict:
        items = list(_posts_by_query.items())
        if drug:
            items = [
                (qid, posts) for qid, posts in items
                if any(p.get("anchor_canon") == drug for p in posts)
            ]

        results = []
        for qid, posts in items:
            top_k = posts[:k]
            relevant_count = 0
            annotated_in_k = 0
            for post in top_k:
                tiktok_id = _extract_tiktok_id(post["doc_id"])
                ann = _annotations_by_id.get(tiktok_id)
                if ann:
                    annotated_in_k += 1
                    if ann["relevance"] >= threshold:
                        relevant_count += 1
            precision = relevant_count / k if k > 0 else 0
            results.append({
                "query_id": qid,
                "precision": precision,
                "relevant_in_k": relevant_count,
                "annotated_in_k": annotated_in_k,
            })

        avg_precision = (
            sum(r["precision"] for r in results) / len(results)
            if results else 0
        )

        return {
            "k": k,
            "threshold": threshold,
            "macro_avg_precision": round(avg_precision, 4),
            "num_queries": len(results),
        }

    def compute_ndcg_at_k(self, k: int = 10, drug: Optional[str] = None) -> dict:
        items = list(_posts_by_query.items())
        if drug:
            items = [
                (qid, posts) for qid, posts in items
                if any(p.get("anchor_canon") == drug for p in posts)
            ]

        results = []
        for qid, posts in items:
            top_k = posts[:k]
            relevances = []
            for post in top_k:
                tiktok_id = _extract_tiktok_id(post["doc_id"])
                ann = _annotations_by_id.get(tiktok_id)
                rel = ann["relevance"] if ann else 0
                relevances.append(rel)

            dcg = self._compute_dcg(relevances)
            ideal_rels = sorted(relevances, reverse=True)
            idcg = self._compute_dcg(ideal_rels)
            ndcg = dcg / idcg if idcg > 0 else 0.0
            results.append({"query_id": qid, "ndcg": round(ndcg, 4)})

        avg_ndcg = (
            sum(r["ndcg"] for r in results) / len(results)
            if results else 0
        )

        return {
            "k": k,
            "macro_avg_ndcg": round(avg_ndcg, 4),
            "num_queries": len(results),
        }

    @staticmethod
    def _compute_dcg(relevances: list[int]) -> float:
        dcg = 0.0
        for i, rel in enumerate(relevances):
            dcg += (2 ** rel - 1) / math.log2(i + 2)
        return dcg
