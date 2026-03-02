import type { StatCard, BarChartItem, LineChartPoint, PostItem } from './types'

const API_BASE = '/api/v1'

// --- Top drugs by platform + time ---
export async function fetchTopDrugsForChat(
  platform: string,
  days: number
): Promise<{ drugs: BarChartItem[]; dateRange?: string }> {
  if (platform === 'all') {
    const res = await fetch(`${API_BASE}/dashboard/overview/top-drugs?limit=10`)
    const data = await res.json()
    return {
      drugs: data.map((d: { scientific_name: string; total_mentions: number }) => ({
        name: d.scientific_name,
        value: d.total_mentions,
      })),
    }
  }

  // Use weekly endpoint (matches dashboard pages) — backend handles time scoping
  const weeks = Math.max(Math.ceil(days / 7), 2)
  const res = await fetch(
    `${API_BASE}/dashboard/trends/weekly?weeks=${weeks}&platform=${platform}`
  )
  const data = await res.json()

  // Extract actual date range from the data
  let minDate = '', maxDate = ''
  for (const item of data) {
    const d = item.date || item.week || ''
    if (d && (!minDate || d < minDate)) minDate = d
    if (d && (!maxDate || d > maxDate)) maxDate = d
  }
  const dateRange = minDate && maxDate ? `${formatDate(minDate)} – ${formatDate(maxDate)}` : undefined

  // Aggregate by drug name
  const drugMap: Record<string, number> = {}
  for (const item of data) {
    const name = item.scientific_name
    if (!name) continue
    drugMap[name] = (drugMap[name] || 0) + (item.mentions || item.video_count || item.total_videos || 0)
  }

  const drugs = Object.entries(drugMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  return { drugs, dateRange }
}

// --- Drug cross-platform stats ---
export async function fetchDrugStatsForChat(
  drugName: string
): Promise<{ stats: StatCard[] }> {
  const res = await fetch(
    `${API_BASE}/dashboard/drugs/${encodeURIComponent(drugName)}/stats`
  )
  const data = await res.json()

  const stats: StatCard[] = []
  if (data.category) stats.push({ label: 'Category', value: data.category })
  if (data.reddit_posts != null)
    stats.push({ label: 'Reddit Posts', value: data.reddit_posts, subtitle: `Score: ${formatNum(data.reddit_score || 0)}` })
  if (data.tiktok_videos != null)
    stats.push({ label: 'TikTok Videos', value: data.tiktok_videos, subtitle: `Views: ${formatNum(data.tiktok_views || 0)}` })
  if (data.youtube_videos != null)
    stats.push({ label: 'YouTube Videos', value: data.youtube_videos, subtitle: `Views: ${formatNum(data.youtube_views || 0)}` })

  return { stats }
}

// --- Drug categories ---
export async function fetchCategoriesForChat(): Promise<{ categories: BarChartItem[] }> {
  const res = await fetch(`${API_BASE}/dashboard/drugs/categories`)
  const data = await res.json()
  return {
    categories: data.map((c: { category: string; drug_count: number }) => ({
      name: c.category,
      value: c.drug_count,
    })),
  }
}

// --- Drugs by category ---
export async function fetchDrugsByCategory(
  category: string,
  limit = 20
): Promise<{ drugs: BarChartItem[] }> {
  const res = await fetch(
    `${API_BASE}/dashboard/drugs?category=${encodeURIComponent(category)}&limit=${limit}`
  )
  const data = await res.json()
  return {
    drugs: (data.drugs || []).map((d: { scientific_name: string; mention_count: number }) => ({
      name: d.scientific_name,
      value: d.mention_count || 0,
    })),
  }
}

// --- Posts/Videos ---
export async function fetchPostsForChat(
  platform: string,
  drug: string,
  days: number,
  limit = 10
): Promise<{ posts: PostItem[]; total: number }> {
  const params = new URLSearchParams({
    drug,
    days: String(days),
    limit: String(limit),
  })
  const res = await fetch(`${API_BASE}/dashboard/posts/${platform}?${params}`)
  const data = await res.json()

  const posts: PostItem[] = (data.posts || []).map((p: Record<string, unknown>) => {
    if (platform === 'reddit') {
      return {
        id: p.id as string,
        title: p.title as string,
        platform: 'reddit',
        drug: p.scientific_name as string,
        score: p.score as number,
        comments: p.num_comments as number,
        date: formatDate(p.created_utc as string),
        url: p.url as string,
        confidence: p.substance_use_confidence as number,
      }
    }
    if (platform === 'tiktok') {
      return {
        id: p.video_id as string,
        title: (p.description as string)?.slice(0, 120) || 'TikTok Video',
        platform: 'tiktok',
        drug: p.scientific_name as string,
        views: p.view_count as number,
        likes: p.like_count as number,
        comments: p.comment_count as number,
        date: formatDate(p.published_at as string),
        url: p.url as string,
        confidence: p.substance_use_confidence as number,
      }
    }
    // youtube
    return {
      id: p.video_id as string,
      title: p.title as string,
      platform: 'youtube',
      drug: p.scientific_name as string,
      views: p.view_count as number,
      likes: p.like_count as number,
      comments: p.comment_count as number,
      date: formatDate(p.published_at as string),
      url: p.url as string,
    }
  })

  return { posts, total: data.total || posts.length }
}

// --- Daily trend for a specific drug ---
export async function fetchDailyTrendForChat(
  drug: string,
  days: number,
  platform = 'all'
): Promise<{ points: LineChartPoint[] }> {
  // Use weekly endpoint for consistency with dashboard pages
  const weeks = Math.max(Math.ceil(days / 7), 4)
  const res = await fetch(
    `${API_BASE}/dashboard/trends/weekly?weeks=${weeks}&drugs=${encodeURIComponent(drug)}&platform=${platform}`
  )
  const data = await res.json()

  // Group by date and sum mentions
  const dateMap: Record<string, number> = {}
  for (const item of data) {
    const date = item.date
    dateMap[date] = (dateMap[date] || 0) + (item.mentions || item.video_count || 0)
  }

  const points = Object.entries(dateMap)
    .map(([date, mentions]) => ({ date, mentions }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return { points }
}

// --- Platform stats ---
export async function fetchPlatformStatsForChat(
  platform: string
): Promise<{ stats: StatCard[] }> {
  if (platform === 'tiktok') {
    const res = await fetch(`${API_BASE}/dashboard/tiktok/stats`)
    const data = await res.json()
    return {
      stats: [
        { label: 'Total Videos', value: formatNum(data.total_videos) },
        { label: 'Total Views', value: formatNum(data.total_views) },
        { label: 'Total Likes', value: formatNum(data.total_likes) },
        { label: 'Unique Drugs', value: data.unique_drugs },
        { label: 'Avg Views/Video', value: formatNum(Math.round(data.avg_views_per_video || 0)) },
      ],
    }
  }

  // Reddit / YouTube — aggregate from weekly trends
  const res = await fetch(
    `${API_BASE}/dashboard/trends/weekly?platform=${platform}&weeks=52`
  )
  const data = await res.json()

  let totalMentions = 0
  let totalEngagement = 0
  const drugs = new Set<string>()
  for (const item of data) {
    totalMentions += item.mentions || item.total_videos || 0
    totalEngagement += item.total_engagement || item.total_views || 0
    if (item.scientific_name) drugs.add(item.scientific_name)
  }

  const platformLabel = platform === 'reddit' ? 'Posts' : 'Videos'
  return {
    stats: [
      { label: `Total ${platformLabel}`, value: formatNum(totalMentions) },
      { label: 'Total Engagement', value: formatNum(totalEngagement) },
      { label: 'Unique Drugs', value: drugs.size },
    ],
  }
}

// --- Platform top drugs ---
export async function fetchPlatformTopDrugs(
  platform: string
): Promise<{ drugs: BarChartItem[] }> {
  if (platform === 'tiktok') {
    const res = await fetch(`${API_BASE}/dashboard/tiktok/drugs-breakdown`)
    const data = await res.json()
    return {
      drugs: data
        .slice(0, 10)
        .map((d: { scientific_name: string; video_count: number }) => ({
          name: d.scientific_name,
          value: d.video_count,
        })),
    }
  }

  // Reddit / YouTube
  const res = await fetch(
    `${API_BASE}/dashboard/trends/weekly?platform=${platform}&weeks=52`
  )
  const data = await res.json()
  const drugMap: Record<string, number> = {}
  for (const item of data) {
    const name = item.scientific_name
    if (name) drugMap[name] = (drugMap[name] || 0) + (item.mentions || item.total_videos || 0)
  }

  return {
    drugs: Object.entries(drugMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
  }
}

// --- Category distribution ---
export async function fetchCategoryDistribution(
  platform: string
): Promise<{ categories: BarChartItem[] }> {
  if (platform === 'tiktok') {
    const res = await fetch(`${API_BASE}/dashboard/tiktok/category-breakdown`)
    const data = await res.json()
    return {
      categories: data.map((c: { category: string; video_count: number }) => ({
        name: c.category,
        value: c.video_count,
      })),
    }
  }

  const res = await fetch(`${API_BASE}/dashboard/overview/category-distribution`)
  const data = await res.json()
  return {
    categories: data.map((c: { category: string; total_mentions: number }) => ({
      name: c.category,
      value: c.total_mentions,
    })),
  }
}

// --- Behavior endpoints ---
export async function fetchBehaviorBreakdown(
  dimension: string
): Promise<{ items: BarChartItem[] }> {
  const res = await fetch(`${API_BASE}/dashboard/tiktok/behavior/${dimension}`)
  const data = await res.json()
  return {
    items: data.map((item: Record<string, unknown>) => ({
      name: (item[dimension.replace(/s$/, '')] || item[Object.keys(item)[0]]) as string,
      value: item.count as number,
    })),
  }
}

export async function fetchBehaviorVideos(
  dimension: string,
  value: string,
  limit = 10
): Promise<{ posts: PostItem[]; total: number }> {
  const params = new URLSearchParams({
    [dimension.replace(/s$/, '')]: value,
    limit: String(limit),
  })
  const res = await fetch(`${API_BASE}/dashboard/tiktok/behavior/videos?${params}`)
  const data = await res.json()

  const posts: PostItem[] = (data.videos || []).map((v: Record<string, unknown>) => ({
    id: v.video_id as string,
    title: (v.description as string)?.slice(0, 120) || 'TikTok Video',
    platform: 'tiktok',
    drug: v.scientific_name as string,
    views: v.view_count as number,
    likes: v.like_count as number,
    comments: v.comment_count as number,
    date: formatDate(v.published_at as string),
    url: v.url as string,
  }))

  return { posts, total: data.total || posts.length }
}

// --- LLM ask ---
export async function askLLM(
  question: string,
  context: Record<string, unknown>
): Promise<{ answer: string; suggestions: string[] }> {
  const res = await fetch(`${API_BASE}/chat/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'LLM service unavailable')
  }

  return res.json()
}

// --- Helpers ---
function formatNum(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return String(num)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
