from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from app.services.bigquery_service import BigQueryService

router = APIRouter()
bq_service = BigQueryService()


# =============================================================================
# Overview / Summary Endpoints
# =============================================================================

@router.get("/overview/stats")
async def get_overview_stats():
    """Get overall statistics for the dashboard."""
    try:
        query = """
        WITH reddit_stats AS (
            SELECT
                COUNT(*) as total_posts,
                SUM(total_score) as total_engagement
            FROM sparkg_gold.weekly_drug_counts
        ),
        tiktok_stats AS (
            SELECT
                SUM(video_count) as total_videos,
                SUM(total_views) as total_views
            FROM sparkg_gold.tiktok_daily_trends
        ),
        youtube_stats AS (
            SELECT
                SUM(total_videos) as total_videos,
                SUM(total_views) as total_views
            FROM sparkg_gold.youtube_weekly_engagement
        )
        SELECT
            r.total_posts as reddit_posts,
            r.total_engagement as reddit_engagement,
            t.total_videos as tiktok_videos,
            t.total_views as tiktok_views,
            y.total_videos as youtube_videos,
            y.total_views as youtube_views
        FROM reddit_stats r, tiktok_stats t, youtube_stats y
        """
        results = bq_service.execute_query(query, 1)
        return results[0] if results else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/overview/top-drugs")
async def get_top_drugs(limit: int = 10):
    """Get top drugs by total mentions across all platforms."""
    try:
        query = f"""
        WITH reddit_counts AS (
            SELECT scientific_name, SUM(post_count) as mentions
            FROM sparkg_gold.weekly_drug_counts
            GROUP BY scientific_name
        ),
        tiktok_counts AS (
            SELECT scientific_name, SUM(video_count) as mentions
            FROM sparkg_gold.tiktok_daily_trends
            GROUP BY scientific_name
        ),
        youtube_counts AS (
            SELECT scientific_name, SUM(total_videos) as mentions
            FROM sparkg_gold.youtube_weekly_engagement
            GROUP BY scientific_name
        ),
        all_counts AS (
            SELECT scientific_name, mentions FROM reddit_counts
            UNION ALL
            SELECT scientific_name, mentions FROM tiktok_counts
            UNION ALL
            SELECT scientific_name, mentions FROM youtube_counts
        )
        SELECT
            a.scientific_name,
            SUM(a.mentions) as total_mentions,
            d.category
        FROM all_counts a
        LEFT JOIN sparkg_gold.drug_terms d ON a.scientific_name = d.scientific_name
        GROUP BY a.scientific_name, d.category
        ORDER BY total_mentions DESC
        LIMIT {limit}
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/overview/category-distribution")
async def get_category_distribution():
    """Get drug mentions grouped by category."""
    try:
        query = """
        WITH reddit_counts AS (
            SELECT scientific_name, SUM(post_count) as mentions
            FROM sparkg_gold.weekly_drug_counts
            GROUP BY scientific_name
        ),
        tiktok_counts AS (
            SELECT scientific_name, SUM(video_count) as mentions
            FROM sparkg_gold.tiktok_daily_trends
            GROUP BY scientific_name
        ),
        youtube_counts AS (
            SELECT scientific_name, SUM(total_videos) as mentions
            FROM sparkg_gold.youtube_weekly_engagement
            GROUP BY scientific_name
        ),
        all_counts AS (
            SELECT scientific_name, mentions FROM reddit_counts
            UNION ALL
            SELECT scientific_name, mentions FROM tiktok_counts
            UNION ALL
            SELECT scientific_name, mentions FROM youtube_counts
        )
        SELECT
            COALESCE(d.category, 'unknown') as category,
            SUM(a.mentions) as total_mentions
        FROM all_counts a
        LEFT JOIN sparkg_gold.drug_terms d ON a.scientific_name = d.scientific_name
        GROUP BY category
        ORDER BY total_mentions DESC
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Temporal Analysis Endpoints
# =============================================================================

@router.get("/trends/daily")
async def get_daily_trends(
    days: int = 30,
    drugs: Optional[str] = None,
    platform: str = "all"
):
    """Get daily drug mention trends for line charts."""
    try:
        drug_filter = ""
        if drugs:
            drug_list = [f"'{d.strip()}'" for d in drugs.split(",")]
            drug_filter = f"AND scientific_name IN ({','.join(drug_list)})"

        if platform == "tiktok":
            query = f"""
            SELECT
                created_date as date,
                scientific_name,
                video_count as mentions,
                total_views
            FROM sparkg_gold.tiktok_daily_trends
            WHERE created_date >= DATE_SUB(CURRENT_DATE(), INTERVAL {days} DAY)
            {drug_filter}
            ORDER BY created_date, scientific_name
            """
        elif platform == "reddit":
            # Reddit uses weekly data, convert to approximate daily
            query = f"""
            SELECT
                DATE(PARSE_DATE('%Y-W%V', week)) as date,
                scientific_name,
                SUM(post_count) as mentions,
                SUM(total_score) as total_engagement
            FROM sparkg_gold.weekly_drug_counts
            WHERE PARSE_DATE('%Y-W%V', week) >= DATE_SUB(CURRENT_DATE(), INTERVAL {days} DAY)
            {drug_filter}
            GROUP BY date, scientific_name
            ORDER BY date, scientific_name
            """
        elif platform == "youtube":
            query = f"""
            SELECT
                DATE(PARSE_DATE('%Y-W%V', week)) as date,
                scientific_name,
                total_videos as mentions,
                total_views
            FROM sparkg_gold.youtube_weekly_engagement
            WHERE PARSE_DATE('%Y-W%V', week) >= DATE_SUB(CURRENT_DATE(), INTERVAL {days} DAY)
            {drug_filter}
            ORDER BY date, scientific_name
            """
        else:
            # Combined from all platforms (using TikTok daily as base)
            query = f"""
            SELECT
                created_date as date,
                scientific_name,
                SUM(video_count) as mentions
            FROM sparkg_gold.tiktok_daily_trends
            WHERE created_date >= DATE_SUB(CURRENT_DATE(), INTERVAL {days} DAY)
            {drug_filter}
            GROUP BY created_date, scientific_name
            ORDER BY created_date, scientific_name
            """

        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/trends/weekly")
async def get_weekly_trends(
    weeks: int = 12,
    drugs: Optional[str] = None,
    platform: str = "all"
):
    """Get weekly drug mention trends."""
    try:
        drug_filter = ""
        if drugs:
            drug_list = [f"'{d.strip()}'" for d in drugs.split(",")]
            drug_filter = f"AND scientific_name IN ({','.join(drug_list)})"

        if platform == "reddit":
            # Query from silver table with is_substance_use filter - group by day for granularity
            base_filter = "WHERE is_substance_use = TRUE AND scientific_name IS NOT NULL"
            if drug_filter:
                base_filter += f" {drug_filter}"
            query = f"""
            SELECT
                FORMAT_DATE('%Y-%m-%d', created_date) as date,
                scientific_name,
                COUNT(*) as mentions,
                SUM(score) as total_engagement,
                SUM(num_comments) as total_comments
            FROM sparkg_silver.reddit_submissions
            {base_filter}
            GROUP BY date, scientific_name
            ORDER BY date DESC, mentions DESC
            LIMIT 1000
            """
        elif platform == "youtube":
            # Query from silver table like Reddit - group by day for granularity
            base_filter = "WHERE scientific_name IS NOT NULL"
            if drug_filter:
                base_filter += f" {drug_filter}"
            query = f"""
            SELECT
                FORMAT_DATE('%Y-%m-%d', created_date) as date,
                scientific_name,
                COUNT(*) as mentions,
                SUM(view_count) as total_views,
                SUM(like_count) as total_likes,
                SUM(comment_count) as total_comments
            FROM sparkg_silver.youtube_videos
            {base_filter}
            GROUP BY date, scientific_name
            ORDER BY date DESC, mentions DESC
            LIMIT 1000
            """
        else:
            query = f"""
            SELECT
                ingestion_week as week,
                scientific_name,
                SUM(video_count) as mentions,
                SUM(total_views) as total_views
            FROM sparkg_gold.tiktok_videos_by_drug_week
            {drug_filter.replace('AND', 'WHERE', 1) if drug_filter else ''}
            GROUP BY ingestion_week, scientific_name
            ORDER BY week DESC, mentions DESC
            LIMIT 1000
            """

        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Posts Browser Endpoints (using Silver tables)
# =============================================================================

@router.get("/posts/reddit")
async def get_reddit_posts(
    limit: int = 20,
    offset: int = 0,
    drug: Optional[str] = None,
    subreddit: Optional[str] = None,
    days: int = 30
):
    """Get Reddit posts from silver table with filters. Only shows classified posts marked as relevant."""
    try:
        filters = [
            f"created_date >= DATE_SUB(CURRENT_DATE(), INTERVAL {days} DAY)",
            "scientific_name IS NOT NULL",  # Only show classified posts
            "is_substance_use = TRUE"  # Only show posts marked as substance use
        ]
        if drug:
            filters.append(f"scientific_name = '{drug}'")
        if subreddit:
            filters.append(f"subreddit = '{subreddit}'")

        where_clause = " AND ".join(filters)

        query = f"""
        SELECT
            id,
            title,
            subreddit,
            author,
            score,
            num_comments,
            created_utc,
            CONCAT('https://reddit.com', permalink) as url,
            scientific_name,
            substance_use_confidence
        FROM sparkg_silver.reddit_submissions
        WHERE {where_clause}
        ORDER BY created_utc DESC
        LIMIT {limit} OFFSET {offset}
        """

        # Also get total count
        count_query = f"""
        SELECT COUNT(*) as total
        FROM sparkg_silver.reddit_submissions
        WHERE {where_clause}
        """

        posts = bq_service.execute_query(query)
        count_result = bq_service.execute_query(count_query, 1)
        total = count_result[0]['total'] if count_result else 0

        return {"posts": posts, "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/posts/tiktok")
async def get_tiktok_posts(
    limit: int = 20,
    offset: int = 0,
    drug: Optional[str] = None,
    days: int = 30
):
    """Get TikTok videos from silver table with filters. Only shows classified posts marked as relevant."""
    try:
        filters = [
            f"created_date >= DATE_SUB(CURRENT_DATE(), INTERVAL {days} DAY)",
            "scientific_name IS NOT NULL",  # Only show classified posts
            "is_substance_use = TRUE"  # Only show posts marked as substance use
        ]
        if drug:
            filters.append(f"scientific_name = '{drug}'")

        where_clause = " AND ".join(filters)

        query = f"""
        SELECT
            video_id,
            description,
            author_username,
            author_display_name,
            view_count,
            like_count,
            comment_count,
            share_count,
            published_at,
            url,
            scientific_name,
            substance_use_confidence,
            transcript
        FROM sparkg_silver.tiktok_videos
        WHERE {where_clause}
        ORDER BY published_at DESC
        LIMIT {limit} OFFSET {offset}
        """

        count_query = f"""
        SELECT COUNT(*) as total
        FROM sparkg_silver.tiktok_videos
        WHERE {where_clause}
        """

        posts = bq_service.execute_query(query)
        count_result = bq_service.execute_query(count_query, 1)
        total = count_result[0]['total'] if count_result else 0

        return {"posts": posts, "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/posts/youtube")
async def get_youtube_posts(
    limit: int = 20,
    offset: int = 0,
    drug: Optional[str] = None,
    days: int = 30
):
    """Get YouTube videos from silver table with filters. Only shows classified posts."""
    try:
        filters = [
            f"created_date >= DATE_SUB(CURRENT_DATE(), INTERVAL {days} DAY)",
            "scientific_name IS NOT NULL"  # Only show classified posts
        ]
        if drug:
            filters.append(f"scientific_name = '{drug}'")

        where_clause = " AND ".join(filters)

        query = f"""
        SELECT
            video_id,
            title,
            channel_title,
            view_count,
            like_count,
            comment_count,
            duration_seconds,
            is_short,
            published_at,
            url,
            scientific_name
        FROM sparkg_silver.youtube_videos
        WHERE {where_clause}
        ORDER BY published_at DESC
        LIMIT {limit} OFFSET {offset}
        """

        count_query = f"""
        SELECT COUNT(*) as total
        FROM sparkg_silver.youtube_videos
        WHERE {where_clause}
        """

        posts = bq_service.execute_query(query)
        count_result = bq_service.execute_query(count_query, 1)
        total = count_result[0]['total'] if count_result else 0

        return {"posts": posts, "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Drug Terms Endpoints
# =============================================================================

@router.get("/drugs")
async def get_drugs(
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "mentions",
    sort_order: str = "desc",
    limit: int = 30,
    offset: int = 0
):
    """Get list of drugs with categories, terms, and mention counts with pagination support."""
    try:
        filters = []
        if category:
            filters.append(f"d.category = '{category}'")
        if search:
            filters.append(f"(LOWER(d.scientific_name) LIKE '%{search.lower()}%' OR LOWER(d.common_terms) LIKE '%{search.lower()}%')")

        where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""

        # Determine sort column
        sort_column = "mention_count" if sort_by == "mentions" else "d.scientific_name"
        sort_dir = "DESC" if sort_order == "desc" else "ASC"

        query = f"""
        WITH reddit_mentions AS (
            SELECT scientific_name, COUNT(*) as post_count
            FROM sparkg_silver.reddit_submissions
            WHERE is_substance_use = TRUE AND scientific_name IS NOT NULL
            GROUP BY scientific_name
        )
        SELECT
            d.scientific_name,
            d.common_terms,
            d.category,
            d.controlled_substance,
            COALESCE(r.post_count, 0) as mention_count
        FROM sparkg_gold.drug_terms d
        LEFT JOIN reddit_mentions r ON d.scientific_name = r.scientific_name
        {where_clause}
        ORDER BY {sort_column} {sort_dir}, d.scientific_name ASC
        LIMIT {limit} OFFSET {offset}
        """

        count_query = f"""
        SELECT COUNT(*) as total
        FROM sparkg_gold.drug_terms d
        {where_clause}
        """

        drugs = bq_service.execute_query(query)
        count_result = bq_service.execute_query(count_query, 1)
        total = count_result[0]['total'] if count_result else 0

        return {"drugs": drugs, "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drugs/categories")
async def get_drug_categories():
    """Get list of all drug categories with counts."""
    try:
        query = """
        SELECT
            category,
            COUNT(*) as drug_count
        FROM sparkg_gold.drug_terms
        GROUP BY category
        ORDER BY drug_count DESC
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drugs/{drug_name}/stats")
async def get_drug_stats(drug_name: str):
    """Get detailed stats for a specific drug."""
    try:
        query = f"""
        WITH reddit_stats AS (
            SELECT
                SUM(post_count) as reddit_posts,
                SUM(total_score) as reddit_score,
                SUM(total_comments) as reddit_comments
            FROM sparkg_gold.weekly_drug_counts
            WHERE scientific_name = '{drug_name}'
        ),
        tiktok_stats AS (
            SELECT
                SUM(video_count) as tiktok_videos,
                SUM(total_views) as tiktok_views,
                SUM(total_likes) as tiktok_likes
            FROM sparkg_gold.tiktok_daily_trends
            WHERE scientific_name = '{drug_name}'
        ),
        youtube_stats AS (
            SELECT
                SUM(total_videos) as youtube_videos,
                SUM(total_views) as youtube_views,
                SUM(total_likes) as youtube_likes
            FROM sparkg_gold.youtube_weekly_engagement
            WHERE scientific_name = '{drug_name}'
        ),
        drug_info AS (
            SELECT category, common_terms, controlled_substance
            FROM sparkg_gold.drug_terms
            WHERE scientific_name = '{drug_name}'
        )
        SELECT
            '{drug_name}' as scientific_name,
            d.category,
            d.common_terms,
            d.controlled_substance,
            r.reddit_posts,
            r.reddit_score,
            r.reddit_comments,
            t.tiktok_videos,
            t.tiktok_views,
            t.tiktok_likes,
            y.youtube_videos,
            y.youtube_views,
            y.youtube_likes
        FROM drug_info d, reddit_stats r, tiktok_stats t, youtube_stats y
        """
        results = bq_service.execute_query(query, 1)
        return results[0] if results else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Filters Endpoints
# =============================================================================

@router.get("/filters/subreddits")
async def get_subreddits(limit: int = 50):
    """Get list of active subreddits from classified posts only."""
    try:
        query = f"""
        SELECT
            subreddit,
            COUNT(*) as total_posts,
            SUM(score) as total_score
        FROM sparkg_silver.reddit_submissions
        WHERE is_substance_use = TRUE AND scientific_name IS NOT NULL
        GROUP BY subreddit
        ORDER BY total_posts DESC
        LIMIT {limit}
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/filters/weeks")
async def get_available_weeks():
    """Get list of available weeks in the data from classified posts."""
    try:
        query = """
        SELECT DISTINCT FORMAT_DATE('%Y-W%V', created_date) as week
        FROM sparkg_silver.reddit_submissions
        WHERE is_substance_use = TRUE AND scientific_name IS NOT NULL
        ORDER BY week DESC
        LIMIT 52
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/filters/reddit-drugs")
async def get_reddit_drugs(limit: int = 500):
    """Get list of drugs actually found in classified Reddit posts."""
    try:
        query = f"""
        SELECT
            scientific_name,
            COUNT(*) as post_count
        FROM sparkg_silver.reddit_submissions
        WHERE is_substance_use = TRUE AND scientific_name IS NOT NULL
        GROUP BY scientific_name
        ORDER BY post_count DESC
        LIMIT {limit}
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# TikTok Specific Endpoints
# =============================================================================

@router.get("/tiktok/stats")
async def get_tiktok_stats():
    """Get TikTok-specific overview stats."""
    try:
        query = """
        SELECT
            COUNT(*) as total_videos,
            SUM(view_count) as total_views,
            SUM(like_count) as total_likes,
            SUM(comment_count) as total_comments,
            SUM(share_count) as total_shares,
            COUNT(DISTINCT scientific_name) as unique_drugs,
            AVG(view_count) as avg_views_per_video,
            AVG(like_count) as avg_likes_per_video
        FROM sparkg_silver.tiktok_videos
        WHERE is_substance_use = TRUE AND scientific_name IS NOT NULL
        """
        results = bq_service.execute_query(query, 1)
        return results[0] if results else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tiktok/drugs-breakdown")
async def get_tiktok_drugs_breakdown():
    """Get breakdown of drugs mentioned in TikTok videos."""
    try:
        query = """
        SELECT
            t.scientific_name,
            COUNT(*) as video_count,
            SUM(t.view_count) as total_views,
            SUM(t.like_count) as total_likes,
            SUM(t.comment_count) as total_comments,
            AVG(t.view_count) as avg_views,
            AVG(t.substance_use_confidence) as avg_confidence,
            d.category
        FROM sparkg_silver.tiktok_videos t
        LEFT JOIN sparkg_gold.drug_terms d ON t.scientific_name = d.scientific_name
        WHERE t.is_substance_use = TRUE AND t.scientific_name IS NOT NULL
        GROUP BY t.scientific_name, d.category
        ORDER BY video_count DESC
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tiktok/recent-videos")
async def get_tiktok_recent_videos(limit: int = 10):
    """Get recent TikTok videos with classification info."""
    try:
        query = f"""
        SELECT
            video_id,
            description,
            author_username,
            view_count,
            like_count,
            comment_count,
            share_count,
            published_at,
            url,
            scientific_name,
            substance_use_confidence,
            SUBSTR(transcript, 1, 200) as transcript_preview
        FROM sparkg_silver.tiktok_videos
        WHERE is_substance_use = TRUE AND scientific_name IS NOT NULL
        ORDER BY published_at DESC
        LIMIT {limit}
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tiktok/category-breakdown")
async def get_tiktok_category_breakdown():
    """Get TikTok videos broken down by drug category."""
    try:
        query = """
        SELECT
            COALESCE(d.category, 'unknown') as category,
            COUNT(*) as video_count,
            SUM(t.view_count) as total_views,
            SUM(t.like_count) as total_likes
        FROM sparkg_silver.tiktok_videos t
        LEFT JOIN sparkg_gold.drug_terms d ON t.scientific_name = d.scientific_name
        WHERE t.is_substance_use = TRUE AND t.scientific_name IS NOT NULL
        GROUP BY category
        ORDER BY video_count DESC
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tiktok/drugs")
async def get_tiktok_drugs(
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "mentions",
    sort_order: str = "desc",
    limit: int = 30,
    offset: int = 0
):
    """Get list of drugs actually found in TikTok videos (from silver table)."""
    try:
        # Build filters for the HAVING clause (post-aggregation)
        having_filters = []
        if category:
            having_filters.append(f"category = '{category}'")
        if search:
            having_filters.append(f"(LOWER(scientific_name) LIKE '%{search.lower()}%' OR LOWER(common_terms) LIKE '%{search.lower()}%')")

        having_clause = f"HAVING {' AND '.join(having_filters)}" if having_filters else ""

        # Determine sort column
        sort_column = "mention_count" if sort_by == "mentions" else "scientific_name"
        sort_dir = "DESC" if sort_order == "desc" else "ASC"

        # Query directly from silver table, only drugs with actual TikTok videos
        query = f"""
        SELECT
            t.scientific_name,
            MAX(d.common_terms) as common_terms,
            MAX(d.category) as category,
            MAX(d.controlled_substance) as controlled_substance,
            COUNT(*) as mention_count
        FROM sparkg_silver.tiktok_videos t
        LEFT JOIN sparkg_gold.drug_terms d ON t.scientific_name = d.scientific_name
        WHERE t.is_substance_use = TRUE AND t.scientific_name IS NOT NULL
        GROUP BY t.scientific_name
        {having_clause}
        ORDER BY {sort_column} {sort_dir}, scientific_name ASC
        LIMIT {limit} OFFSET {offset}
        """

        # Count query for pagination
        count_query = f"""
        SELECT COUNT(DISTINCT t.scientific_name) as total
        FROM sparkg_silver.tiktok_videos t
        LEFT JOIN sparkg_gold.drug_terms d ON t.scientific_name = d.scientific_name
        WHERE t.is_substance_use = TRUE AND t.scientific_name IS NOT NULL
        {having_clause.replace('HAVING', 'AND') if having_clause else ''}
        """

        drugs = bq_service.execute_query(query)
        count_result = bq_service.execute_query(count_query, 1)
        total = count_result[0]['total'] if count_result else 0

        return {"drugs": drugs, "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/filters/tiktok-drugs")
async def get_tiktok_drugs_filter(limit: int = 500):
    """Get list of drugs actually found in classified TikTok videos (reduced list)."""
    try:
        query = f"""
        SELECT
            scientific_name,
            COUNT(*) as video_count
        FROM sparkg_silver.tiktok_videos
        WHERE is_substance_use = TRUE AND scientific_name IS NOT NULL
        GROUP BY scientific_name
        ORDER BY video_count DESC
        LIMIT {limit}
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# YouTube Specific Endpoints
# =============================================================================

@router.get("/youtube/drugs")
async def get_youtube_drugs(
    category: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "mentions",
    sort_order: str = "desc",
    limit: int = 30,
    offset: int = 0
):
    """Get list of drugs actually found in YouTube videos (from silver table)."""
    try:
        # Build filters for the HAVING clause (post-aggregation)
        having_filters = []
        if category:
            having_filters.append(f"category = '{category}'")
        if search:
            having_filters.append(f"(LOWER(scientific_name) LIKE '%{search.lower()}%' OR LOWER(common_terms) LIKE '%{search.lower()}%')")

        having_clause = f"HAVING {' AND '.join(having_filters)}" if having_filters else ""

        # Determine sort column
        sort_column = "mention_count" if sort_by == "mentions" else "scientific_name"
        sort_dir = "DESC" if sort_order == "desc" else "ASC"

        # Query directly from silver table, only drugs with actual YouTube videos
        query = f"""
        SELECT
            y.scientific_name,
            MAX(d.common_terms) as common_terms,
            MAX(d.category) as category,
            MAX(d.controlled_substance) as controlled_substance,
            COUNT(*) as mention_count
        FROM sparkg_silver.youtube_videos y
        LEFT JOIN sparkg_gold.drug_terms d ON y.scientific_name = d.scientific_name
        WHERE y.scientific_name IS NOT NULL
        GROUP BY y.scientific_name
        {having_clause}
        ORDER BY {sort_column} {sort_dir}, scientific_name ASC
        LIMIT {limit} OFFSET {offset}
        """

        # Count query for pagination
        count_query = f"""
        SELECT COUNT(DISTINCT y.scientific_name) as total
        FROM sparkg_silver.youtube_videos y
        LEFT JOIN sparkg_gold.drug_terms d ON y.scientific_name = d.scientific_name
        WHERE y.scientific_name IS NOT NULL
        {having_clause.replace('HAVING', 'AND') if having_clause else ''}
        """

        drugs = bq_service.execute_query(query)
        count_result = bq_service.execute_query(count_query, 1)
        total = count_result[0]['total'] if count_result else 0

        return {"drugs": drugs, "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/filters/youtube-drugs")
async def get_youtube_drugs_filter(limit: int = 500):
    """Get list of drugs actually found in classified YouTube videos (reduced list)."""
    try:
        query = f"""
        SELECT
            scientific_name,
            COUNT(*) as video_count
        FROM sparkg_silver.youtube_videos
        WHERE scientific_name IS NOT NULL
        GROUP BY scientific_name
        ORDER BY video_count DESC
        LIMIT {limit}
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# TikTok Behavior Analysis Endpoints
# =============================================================================
# behavior_identified column is ARRAY<STRING> with pipe-separated "key : value" pairs
# Example element: "intent : educational | behavior : descalation behavior | state : withdrawal"


@router.get("/tiktok/behavior/settings")
async def get_tiktok_behavior_settings(limit: int = 20):
    """Get breakdown of behavioral settings (intent) in TikTok videos."""
    try:
        query = f"""
        WITH extracted AS (
            SELECT
                TRIM(REGEXP_EXTRACT(behavior_item, r'(?i)intent\\s*:\\s*([^|]+)')) as setting
            FROM sparkg_silver.tiktok_videos,
            UNNEST(behavior_identified) as behavior_item
            WHERE behavior_identified IS NOT NULL
                AND ARRAY_LENGTH(behavior_identified) > 0
        )
        SELECT setting, COUNT(*) as count
        FROM extracted
        WHERE setting IS NOT NULL AND TRIM(setting) != ''
        GROUP BY setting
        ORDER BY count DESC
        LIMIT {limit}
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tiktok/behavior/states")
async def get_tiktok_psychological_states(limit: int = 20):
    """Get breakdown of psychological states in TikTok videos."""
    try:
        query = f"""
        WITH extracted AS (
            SELECT
                TRIM(REGEXP_EXTRACT(behavior_item, r'(?i)state\\s*:\\s*([^|]+)')) as state
            FROM sparkg_silver.tiktok_videos,
            UNNEST(behavior_identified) as behavior_item
            WHERE behavior_identified IS NOT NULL
                AND ARRAY_LENGTH(behavior_identified) > 0
        )
        SELECT state, COUNT(*) as count
        FROM extracted
        WHERE state IS NOT NULL AND TRIM(state) != ''
        GROUP BY state
        ORDER BY count DESC
        LIMIT {limit}
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tiktok/behavior/reinforcement")
async def get_tiktok_reinforcement_patterns(limit: int = 20):
    """Get breakdown of reinforcement patterns in TikTok videos."""
    try:
        query = f"""
        WITH extracted AS (
            SELECT
                TRIM(REGEXP_EXTRACT(behavior_item, r'(?i)reinforcement\\s*:\\s*([^|]+)')) as reinforcement
            FROM sparkg_silver.tiktok_videos,
            UNNEST(behavior_identified) as behavior_item
            WHERE behavior_identified IS NOT NULL
                AND ARRAY_LENGTH(behavior_identified) > 0
        )
        SELECT reinforcement, COUNT(*) as count
        FROM extracted
        WHERE reinforcement IS NOT NULL AND TRIM(reinforcement) != ''
        GROUP BY reinforcement
        ORDER BY count DESC
        LIMIT {limit}
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tiktok/behavior/outcomes")
async def get_tiktok_behavioral_outcomes(limit: int = 20):
    """Get breakdown of behavioral outcomes in TikTok videos."""
    try:
        query = f"""
        WITH extracted AS (
            SELECT
                TRIM(REGEXP_EXTRACT(behavior_item, r'(?i)outcome\\s*:\\s*([^|]+)')) as outcome
            FROM sparkg_silver.tiktok_videos,
            UNNEST(behavior_identified) as behavior_item
            WHERE behavior_identified IS NOT NULL
                AND ARRAY_LENGTH(behavior_identified) > 0
        )
        SELECT outcome, COUNT(*) as count
        FROM extracted
        WHERE outcome IS NOT NULL AND TRIM(outcome) != ''
        GROUP BY outcome
        ORDER BY count DESC
        LIMIT {limit}
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tiktok/behavior/behaviors")
async def get_tiktok_behavior_types(limit: int = 20):
    """Get breakdown of behavior types in TikTok videos."""
    try:
        query = f"""
        WITH extracted AS (
            SELECT
                TRIM(REGEXP_EXTRACT(behavior_item, r'(?i)behavior\\s*:\\s*([^|]+)')) as behavior
            FROM sparkg_silver.tiktok_videos,
            UNNEST(behavior_identified) as behavior_item
            WHERE behavior_identified IS NOT NULL
                AND ARRAY_LENGTH(behavior_identified) > 0
        )
        SELECT behavior, COUNT(*) as count
        FROM extracted
        WHERE behavior IS NOT NULL AND TRIM(behavior) != ''
        GROUP BY behavior
        ORDER BY count DESC
        LIMIT {limit}
        """
        return bq_service.execute_query(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tiktok/behavior/filters")
async def get_tiktok_behavior_filter_options():
    """Get all available filter options for behavior page."""
    try:
        # Get unique intents (settings)
        settings_query = """
        WITH extracted AS (
            SELECT DISTINCT
                TRIM(REGEXP_EXTRACT(behavior_item, r'(?i)intent\\s*:\\s*([^|]+)')) as value
            FROM sparkg_silver.tiktok_videos,
            UNNEST(behavior_identified) as behavior_item
            WHERE behavior_identified IS NOT NULL
                AND ARRAY_LENGTH(behavior_identified) > 0
        )
        SELECT value FROM extracted
        WHERE value IS NOT NULL AND TRIM(value) != ''
        ORDER BY value
        """

        # Get unique behavior types
        behaviors_query = """
        WITH extracted AS (
            SELECT DISTINCT
                TRIM(REGEXP_EXTRACT(behavior_item, r'(?i)behavior\\s*:\\s*([^|]+)')) as value
            FROM sparkg_silver.tiktok_videos,
            UNNEST(behavior_identified) as behavior_item
            WHERE behavior_identified IS NOT NULL
                AND ARRAY_LENGTH(behavior_identified) > 0
        )
        SELECT value FROM extracted
        WHERE value IS NOT NULL AND TRIM(value) != ''
        ORDER BY value
        """

        # Get unique states
        states_query = """
        WITH extracted AS (
            SELECT DISTINCT
                TRIM(REGEXP_EXTRACT(behavior_item, r'(?i)state\\s*:\\s*([^|]+)')) as value
            FROM sparkg_silver.tiktok_videos,
            UNNEST(behavior_identified) as behavior_item
            WHERE behavior_identified IS NOT NULL
                AND ARRAY_LENGTH(behavior_identified) > 0
        )
        SELECT value FROM extracted
        WHERE value IS NOT NULL AND TRIM(value) != ''
        ORDER BY value
        """

        # Get unique reinforcement patterns
        reinforcement_query = """
        WITH extracted AS (
            SELECT DISTINCT
                TRIM(REGEXP_EXTRACT(behavior_item, r'(?i)reinforcement\\s*:\\s*([^|]+)')) as value
            FROM sparkg_silver.tiktok_videos,
            UNNEST(behavior_identified) as behavior_item
            WHERE behavior_identified IS NOT NULL
                AND ARRAY_LENGTH(behavior_identified) > 0
        )
        SELECT value FROM extracted
        WHERE value IS NOT NULL AND TRIM(value) != ''
        ORDER BY value
        """

        # Get unique outcomes
        outcomes_query = """
        WITH extracted AS (
            SELECT DISTINCT
                TRIM(REGEXP_EXTRACT(behavior_item, r'(?i)outcome\\s*:\\s*([^|]+)')) as value
            FROM sparkg_silver.tiktok_videos,
            UNNEST(behavior_identified) as behavior_item
            WHERE behavior_identified IS NOT NULL
                AND ARRAY_LENGTH(behavior_identified) > 0
        )
        SELECT value FROM extracted
        WHERE value IS NOT NULL AND TRIM(value) != ''
        ORDER BY value
        """

        settings = bq_service.execute_query(settings_query)
        behaviors = bq_service.execute_query(behaviors_query)
        states = bq_service.execute_query(states_query)
        reinforcement = bq_service.execute_query(reinforcement_query)
        outcomes = bq_service.execute_query(outcomes_query)

        return {
            "settings": [s['value'] for s in settings if s.get('value')],
            "behaviors": [b['value'] for b in behaviors if b.get('value')],
            "states": [s['value'] for s in states if s.get('value')],
            "reinforcement": [r['value'] for r in reinforcement if r.get('value')],
            "outcomes": [o['value'] for o in outcomes if o.get('value')]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tiktok/behavior/videos")
async def get_tiktok_behavior_videos(
    limit: int = 20,
    offset: int = 0,
    setting: Optional[str] = None,
    behavior: Optional[str] = None,
    state: Optional[str] = None,
    reinforcement: Optional[str] = None,
    outcome: Optional[str] = None
):
    """Get TikTok videos filtered by behavioral patterns."""
    try:
        filters = [
            "behavior_identified IS NOT NULL",
            "ARRAY_LENGTH(behavior_identified) > 0"
        ]

        # Filter using EXISTS with UNNEST to check array elements
        if setting:
            filters.append(f"EXISTS (SELECT 1 FROM UNNEST(behavior_identified) AS bi WHERE REGEXP_CONTAINS(bi, r'(?i)intent\\s*:\\s*[^|]*{setting}'))")
        if behavior:
            filters.append(f"EXISTS (SELECT 1 FROM UNNEST(behavior_identified) AS bi WHERE REGEXP_CONTAINS(bi, r'(?i)behavior\\s*:\\s*[^|]*{behavior}'))")
        if state:
            filters.append(f"EXISTS (SELECT 1 FROM UNNEST(behavior_identified) AS bi WHERE REGEXP_CONTAINS(bi, r'(?i)state\\s*:\\s*[^|]*{state}'))")
        if reinforcement:
            filters.append(f"EXISTS (SELECT 1 FROM UNNEST(behavior_identified) AS bi WHERE REGEXP_CONTAINS(bi, r'(?i)reinforcement\\s*:\\s*[^|]*{reinforcement}'))")
        if outcome:
            filters.append(f"EXISTS (SELECT 1 FROM UNNEST(behavior_identified) AS bi WHERE REGEXP_CONTAINS(bi, r'(?i)outcome\\s*:\\s*[^|]*{outcome}'))")

        where_clause = " AND ".join(filters)

        query = f"""
        SELECT
            video_id,
            description,
            author_username,
            view_count,
            like_count,
            comment_count,
            share_count,
            published_at,
            url,
            scientific_name,
            behavior_identified,
            annotation_definition,
            annotation_reasoning,
            (SELECT TRIM(REGEXP_EXTRACT(bi, r'(?i)intent\\s*:\\s*([^|]+)')) FROM UNNEST(behavior_identified) AS bi WHERE REGEXP_CONTAINS(bi, r'(?i)intent\\s*:') LIMIT 1) as intent,
            (SELECT TRIM(REGEXP_EXTRACT(bi, r'(?i)behavior\\s*:\\s*([^|]+)')) FROM UNNEST(behavior_identified) AS bi WHERE REGEXP_CONTAINS(bi, r'(?i)behavior\\s*:') LIMIT 1) as behavior_type,
            (SELECT TRIM(REGEXP_EXTRACT(bi, r'(?i)state\\s*:\\s*([^|]+)')) FROM UNNEST(behavior_identified) AS bi WHERE REGEXP_CONTAINS(bi, r'(?i)state\\s*:') LIMIT 1) as state,
            (SELECT TRIM(REGEXP_EXTRACT(bi, r'(?i)reinforcement\\s*:\\s*([^|]+)')) FROM UNNEST(behavior_identified) AS bi WHERE REGEXP_CONTAINS(bi, r'(?i)reinforcement\\s*:') LIMIT 1) as reinforcement_pattern,
            (SELECT TRIM(REGEXP_EXTRACT(bi, r'(?i)outcome\\s*:\\s*([^|]+)')) FROM UNNEST(behavior_identified) AS bi WHERE REGEXP_CONTAINS(bi, r'(?i)outcome\\s*:') LIMIT 1) as outcome
        FROM sparkg_silver.tiktok_videos
        WHERE {where_clause}
        ORDER BY published_at DESC
        LIMIT {limit} OFFSET {offset}
        """

        count_query = f"""
        SELECT COUNT(*) as total
        FROM sparkg_silver.tiktok_videos
        WHERE {where_clause}
        """

        videos = bq_service.execute_query(query)
        count_result = bq_service.execute_query(count_query, 1)
        total = count_result[0]['total'] if count_result else 0

        return {"videos": videos, "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Export Data Endpoints
# =============================================================================

@router.get("/export/date-range/{platform}")
async def get_export_date_range(platform: str):
    """Get available date range for a platform."""
    try:
        if platform == "reddit":
            query = """
            SELECT
                MIN(created_date) as min_date,
                MAX(created_date) as max_date
            FROM sparkg_silver.reddit_submissions
            WHERE is_substance_use = TRUE AND scientific_name IS NOT NULL
            """
        elif platform == "tiktok":
            query = """
            SELECT
                MIN(DATE(published_at)) as min_date,
                MAX(DATE(published_at)) as max_date
            FROM sparkg_silver.tiktok_videos
            WHERE is_substance_use = TRUE AND scientific_name IS NOT NULL
            """
        elif platform == "youtube":
            query = """
            SELECT
                MIN(created_date) as min_date,
                MAX(created_date) as max_date
            FROM sparkg_silver.youtube_videos
            WHERE scientific_name IS NOT NULL
            """
        else:
            raise HTTPException(status_code=400, detail="Invalid platform")

        result = bq_service.execute_query(query)
        if result:
            return {
                "min_date": str(result[0]['min_date']) if result[0]['min_date'] else None,
                "max_date": str(result[0]['max_date']) if result[0]['max_date'] else None
            }
        return {"min_date": None, "max_date": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/drugs/{platform}")
async def get_export_drugs(platform: str):
    """Get available drugs for a platform."""
    try:
        if platform == "reddit":
            query = """
            SELECT DISTINCT scientific_name
            FROM sparkg_silver.reddit_submissions
            WHERE is_substance_use = TRUE AND scientific_name IS NOT NULL
            ORDER BY scientific_name
            """
        elif platform == "tiktok":
            query = """
            SELECT DISTINCT scientific_name
            FROM sparkg_silver.tiktok_videos
            WHERE is_substance_use = TRUE AND scientific_name IS NOT NULL
            ORDER BY scientific_name
            """
        elif platform == "youtube":
            query = """
            SELECT DISTINCT scientific_name
            FROM sparkg_silver.youtube_videos
            WHERE scientific_name IS NOT NULL
            ORDER BY scientific_name
            """
        else:
            raise HTTPException(status_code=400, detail="Invalid platform")

        result = bq_service.execute_query(query)
        return [r['scientific_name'] for r in result if r.get('scientific_name')]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@router.get("/export/data/{platform}")
async def export_platform_data(
    platform: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    drug: Optional[str] = None,
    limit: int = 10000
):
    """Export data for a platform with optional filters."""
    try:
        from datetime import datetime

        if platform == "reddit":
            filters = ["is_substance_use = TRUE", "scientific_name IS NOT NULL"]
            date_field = "created_date"

            if start_date:
                filters.append(f"{date_field} >= '{start_date}'")
            if end_date:
                filters.append(f"{date_field} <= '{end_date}'")
            if drug:
                filters.append(f"scientific_name = '{drug}'")

            where_clause = " AND ".join(filters)

            query = f"""
            SELECT
                id as post_id,
                subreddit,
                title,
                selftext as content,
                score,
                num_comments,
                created_utc,
                created_date,
                url,
                scientific_name
            FROM sparkg_silver.reddit_submissions
            WHERE {where_clause}
            ORDER BY created_utc DESC
            LIMIT {limit}
            """

        elif platform == "tiktok":
            filters = ["is_substance_use = TRUE", "scientific_name IS NOT NULL"]
            date_field = "published_at"

            if start_date:
                filters.append(f"DATE({date_field}) >= '{start_date}'")
            if end_date:
                filters.append(f"DATE({date_field}) <= '{end_date}'")
            if drug:
                filters.append(f"scientific_name = '{drug}'")

            where_clause = " AND ".join(filters)

            query = f"""
            SELECT
                video_id,
                description,
                view_count,
                like_count,
                comment_count,
                share_count,
                published_at,
                url,
                scientific_name,
                behavior_identified
            FROM sparkg_silver.tiktok_videos
            WHERE {where_clause}
            ORDER BY published_at DESC
            LIMIT {limit}
            """

        elif platform == "youtube":
            filters = ["scientific_name IS NOT NULL"]
            date_field = "published_at"

            if start_date:
                filters.append(f"DATE({date_field}) >= '{start_date}'")
            if end_date:
                filters.append(f"DATE({date_field}) <= '{end_date}'")
            if drug:
                filters.append(f"scientific_name = '{drug}'")

            where_clause = " AND ".join(filters)

            query = f"""
            SELECT
                video_id,
                title,
                description,
                view_count,
                like_count,
                comment_count,
                published_at,
                url,
                scientific_name
            FROM sparkg_silver.youtube_videos
            WHERE {where_clause}
            ORDER BY published_at DESC
            LIMIT {limit}
            """
        else:
            raise HTTPException(status_code=400, detail="Invalid platform")

        data = bq_service.execute_query(query)

        return {
            "export_info": {
                "platform": platform,
                "filters": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "drug": drug
                },
                "exported_at": datetime.utcnow().isoformat() + "Z",
                "total_records": len(data)
            },
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
