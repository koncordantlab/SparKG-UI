import axios from 'axios'

const API_BASE = '/api/v1'

// =============================================================================
// Overview / Summary
// =============================================================================

export async function getOverviewStats() {
  const response = await axios.get(`${API_BASE}/dashboard/overview/stats`)
  return response.data
}

export async function getTopDrugs(limit: number = 10) {
  const response = await axios.get(`${API_BASE}/dashboard/overview/top-drugs`, {
    params: { limit }
  })
  return response.data
}

export async function getCategoryDistribution() {
  const response = await axios.get(`${API_BASE}/dashboard/overview/category-distribution`)
  return response.data
}

// =============================================================================
// Trends
// =============================================================================

export async function getDailyTrends(days: number = 30, drugs?: string, platform: string = 'all') {
  const response = await axios.get(`${API_BASE}/dashboard/trends/daily`, {
    params: { days, drugs, platform }
  })
  return response.data
}

export async function getWeeklyTrends(weeks: number = 12, drugs?: string, platform: string = 'all') {
  const response = await axios.get(`${API_BASE}/dashboard/trends/weekly`, {
    params: { weeks, drugs, platform }
  })
  return response.data
}

// =============================================================================
// Posts
// =============================================================================

export async function getRedditPosts(params: {
  limit?: number
  offset?: number
  drug?: string
  subreddit?: string
  days?: number
}) {
  const response = await axios.get(`${API_BASE}/dashboard/posts/reddit`, { params })
  return response.data
}

export async function getTikTokPosts(params: {
  limit?: number
  offset?: number
  drug?: string
  days?: number
}) {
  const response = await axios.get(`${API_BASE}/dashboard/posts/tiktok`, { params })
  return response.data
}

export async function getYouTubePosts(params: {
  limit?: number
  offset?: number
  drug?: string
  days?: number
}) {
  const response = await axios.get(`${API_BASE}/dashboard/posts/youtube`, { params })
  return response.data
}

// =============================================================================
// Drugs
// =============================================================================

export async function getDrugs(params?: {
  category?: string
  search?: string
  limit?: number
}) {
  const response = await axios.get(`${API_BASE}/dashboard/drugs`, { params })
  return response.data
}

export async function getDrugCategories() {
  const response = await axios.get(`${API_BASE}/dashboard/drugs/categories`)
  return response.data
}

export async function getDrugStats(drugName: string) {
  const response = await axios.get(`${API_BASE}/dashboard/drugs/${encodeURIComponent(drugName)}/stats`)
  return response.data
}

// =============================================================================
// Filters
// =============================================================================

export async function getSubreddits(limit: number = 50) {
  const response = await axios.get(`${API_BASE}/dashboard/filters/subreddits`, {
    params: { limit }
  })
  return response.data
}

export async function getAvailableWeeks() {
  const response = await axios.get(`${API_BASE}/dashboard/filters/weeks`)
  return response.data
}

// =============================================================================
// Legacy BigQuery endpoints
// =============================================================================

export async function fetchDatasets() {
  const response = await axios.get(`${API_BASE}/datasets`)
  return response.data
}

export async function fetchTables(datasetId: string) {
  const response = await axios.get(`${API_BASE}/datasets/${datasetId}/tables`)
  return response.data
}

export async function getTableSchema(datasetId: string, tableId: string) {
  const response = await axios.get(`${API_BASE}/datasets/${datasetId}/tables/${tableId}/schema`)
  return response.data
}

export async function previewTable(datasetId: string, tableId: string, limit: number = 100) {
  const response = await axios.get(`${API_BASE}/datasets/${datasetId}/tables/${tableId}/preview`, {
    params: { limit }
  })
  return response.data
}

export async function executeQuery(query: string, maxResults: number = 1000) {
  const response = await axios.post(`${API_BASE}/query`, {
    query,
    max_results: maxResults
  })
  return response.data
}
