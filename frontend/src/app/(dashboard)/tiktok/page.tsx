'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const CATEGORY_COLORS: Record<string, string> = {
  opioid: 'bg-gray-100 text-gray-700',
  stimulant: 'bg-gray-100 text-gray-700',
  dissociative: 'bg-gray-100 text-gray-700',
  benzodiazepine: 'bg-gray-100 text-gray-700',
  cannabinoid: 'bg-gray-100 text-gray-700',
  psychedelic: 'bg-gray-100 text-gray-700',
  sedative: 'bg-gray-100 text-gray-700',
  muscle_relaxant: 'bg-gray-100 text-gray-700',
  antihistamine: 'bg-gray-100 text-gray-700',
  unknown: 'bg-gray-100 text-gray-700',
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6']

interface TikTokStats {
  total_videos: number
  total_views: number
  total_likes: number
  total_comments: number
  total_shares: number
  unique_drugs: number
  avg_views_per_video: number
  avg_likes_per_video: number
}

interface DrugBreakdown {
  scientific_name: string
  video_count: number
  total_views: number
  total_likes: number
  total_comments: number
  avg_views: number
  avg_confidence: number
  category: string
}

interface RecentVideo {
  video_id: string
  description: string
  author_username: string
  view_count: number
  like_count: number
  comment_count: number
  share_count: number
  published_at: string
  url: string
  scientific_name: string
  substance_use_confidence: number
  transcript_preview: string
}

interface CategoryBreakdown {
  category: string
  video_count: number
  total_views: number
  total_likes: number
}

interface DailyData {
  date: string
  scientific_name: string
  mentions: number
  total_views: number
}

//

interface TopDrug {
  scientific_name: string
  mentions: number
}

const monthOptions = [
  { value: '', label: 'All Months' },
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

export default function TikTokDashboard() {
  const [stats, setStats] = useState<TikTokStats | null>(null)
  const [drugsBreakdown, setDrugsBreakdown] = useState<DrugBreakdown[]>([])
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([])
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([])
  const [loading, setLoading] = useState(true)


  const [dailyData, setDailyData] = useState<DailyData[]>([])
    // Date filters
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [topDrugs, setTopDrugs] = useState<TopDrug[]>([])
  const [filteredData, setFilteredData] = useState<DailyData[]>([])
  const [selectedDrugs, setSelectedDrugs] = useState<string[]>([])

  //note: might need to grab the usememos and the filtered data from reddit, not sure yet.

  const availableYears = useMemo(() => {
      const years = new Set<string>()
      dailyData.forEach(d => {
        const year = d.date.split('-')[0]
        if (year) years.add(year)
      })
      return Array.from(years).sort().reverse()
    }, [dailyData])
  
    // Extract available months for selected year
    const availableMonths = useMemo(() => {
      if (!selectedYear) return []
      const months = new Set<string>()
      dailyData
        .filter(d => d.date.startsWith(selectedYear))
        .forEach(d => {
          const month = d.date.split('-')[1]
          if (month) months.add(month)
        })
      return Array.from(months).sort()
    }, [dailyData, selectedYear])
  
    useEffect(() => {
      loadData()
    }, [])
  
    useEffect(() => {
      filterData()
    }, [dailyData, selectedYear, selectedMonth])

  const loadData = async () => {
    try {
      setLoading(true)

      const [statsRes, drugsRes, videosRes, catRes, dailyRes] = await Promise.all([
        fetch('/api/v1/dashboard/tiktok/stats'),
        fetch('/api/v1/dashboard/tiktok/drugs-breakdown'),
        fetch('/api/v1/dashboard/tiktok/recent-videos?limit=8'),
        fetch('/api/v1/dashboard/tiktok/category-breakdown'),
        fetch('/api/v1/dashboard/trends/daily?platform=tiktok&days=730')
      ])

      const [statsData, drugsData, videosData, catData, dailyData] = await Promise.all([
        statsRes.json(),
        drugsRes.json(),
        videosRes.json(),
        catRes.json(),
        dailyRes.json()
      ])

      setStats(statsData)
      setDrugsBreakdown(Array.isArray(drugsData) ? drugsData : [])
      setRecentVideos(Array.isArray(videosData) ? videosData : [])
      setCategoryBreakdown(Array.isArray(catData) ? catData : [])
      setDailyData(Array.isArray(dailyData) ? dailyData : [])
    } catch (err) {
      console.error('Failed to load TikTok data:', err)
    } finally {
      setLoading(false)
    }
  }

  //everytihing below is for the line graphs

  const filterData = () => {
    let data = [...dailyData]

    // Filter by year (date format: "2026-01-02")
    if (selectedYear) {
      data = data.filter(d => d.date.startsWith(selectedYear))
    }

    // Filter by month
    if (selectedMonth) {
      data = data.filter(d => {
        const [year, month] = d.date.split('-')
        return year === selectedYear && month === selectedMonth
      })
    }

    setFilteredData(data)

    // Recalculate stats and top drugs based on filtered data
    const drugMentions = data.reduce((acc: Record<string, number>, item: DailyData) => {
      acc[item.scientific_name] = (acc[item.scientific_name] || 0) + item.mentions
      return acc
    }, {})

    const topDrugNames = Object.entries(drugMentions)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([name]) => name)

    if (selectedDrugs.length === 0 || !selectedDrugs.some(d => topDrugNames.includes(d))) {
      setSelectedDrugs(topDrugNames)
    }

    const topDrugsCalc = Object.entries(drugMentions)
      .map(([name, mentions]) => ({
        scientific_name: name,
        mentions: mentions as number,
        total_score: data
          .filter((d: DailyData) => d.scientific_name === name)
          .reduce((sum: number, d: DailyData) => sum + (d.total_views || 0), 0)
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 10)
    setTopDrugs(topDrugsCalc)
  }

      // Transform daily data for line chart
    const getLineChartData = () => {
    const dateMap: Record<string, Record<string, number | string>> = {}
    //this feels really iffy
    filteredData
      .filter(d => selectedDrugs.includes(d.scientific_name))
      .forEach(d => {
        if (!dateMap[d.date]) {
          dateMap[d.date] = {
            date: d.date,
            displayDate: formatDateLabel(d.date)
          } as Record<string, number | string>
        }
        dateMap[d.date][d.scientific_name] = d.mentions
      })

    return Object.values(dateMap).sort((a, b) =>
      (a.date as string).localeCompare(b.date as string)
    )
  }
  

  const clearFilters = () => {
    setSelectedYear('')
    setSelectedMonth('')
  } 

  const toggleDrug = (drug: string) => {
    setSelectedDrugs(prev =>
      prev.includes(drug)
        ? prev.filter(d => d !== drug)
        : [...prev, drug]
    )
  }

  const formatDateLabel = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[month - 1]} ${day}`
  }

  //note: everything above is added to ensure the line graph works

  const formatNumber = (num: number) => {
    if (!num) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50'
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  // Calculate max video count for bar widths
  const maxVideos = Math.max(...(drugsBreakdown || []).map(d => d.video_count), 1)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading TikTok analytics...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">TikTok Dashboard</h1>
        <p className="text-gray-500">Drug mention analytics from classified TikTok videos</p>
      </div>

      {/* Date Filters */} 
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value)
                setSelectedMonth('') // Reset month when year changes
              }}
              className="border rounded-lg px-3 py-2 min-w-[120px]"
            >
              <option value="">All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border rounded-lg px-3 py-2 min-w-[140px]"
              disabled={!selectedYear}
            >
              <option value="">All Months</option>
              {selectedYear && availableMonths.map(month => {
                const monthOption = monthOptions.find(m => m.value === month)
                return (
                  <option key={month} value={month}>
                    {monthOption?.label || month}
                  </option>
                )
              })}
            </select>
          </div>

          <button
            onClick={clearFilters}
            className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            Clear Filters
          </button>

          <div className="ml-auto text-sm text-gray-500">
            {availableYears.length > 0 ? (
              <>Data available: {availableYears[availableYears.length - 1]} - {availableYears[0]}</>
            ) : (
              'No data available'
            )}
            {' • '}
            Showing {filteredData.length} data points
          </div>
        </div>
      </div> 

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Videos</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(stats?.total_videos || 0)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Views</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(stats?.total_views || 0)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Likes</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(stats?.total_likes || 0)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Unique Drugs</p>
              <p className="text-xl font-bold text-gray-900">{stats?.unique_drugs || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Averages Row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-900 rounded-xl shadow-sm p-4 text-white">
          <p className="text-sm text-gray-400">Avg. Views per Video</p>
          <p className="text-2xl font-bold">{formatNumber(stats?.avg_views_per_video || 0)}</p>
        </div>
        <div className="bg-gray-800 rounded-xl shadow-sm p-4 text-white">
          <p className="text-sm text-gray-400">Avg. Likes per Video</p>
          <p className="text-2xl font-bold">{formatNumber(stats?.avg_likes_per_video || 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Drugs Breakdown */}
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Drugs by Video Count</h3>
            <span className="text-sm text-gray-500">{drugsBreakdown.length} drugs</span>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {drugsBreakdown.map((drug) => (
              <div key={drug.scientific_name} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{drug.scientific_name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[drug.category] || CATEGORY_COLORS.unknown}`}>
                      {drug.category || 'unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {drug.avg_confidence && (
                      <span className={`px-1.5 py-0.5 rounded ${getConfidenceColor(drug.avg_confidence)}`}>
                        {Math.round(drug.avg_confidence * 100)}%
                      </span>
                    )}
                    <span>{drug.video_count} videos</span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-800 rounded-full transition-all"
                    style={{ width: `${(drug.video_count / maxVideos) * 100}%` }}
                  />
                </div>
                <div className="flex gap-4 mt-1 text-xs text-gray-400">
                  <span>{formatNumber(drug.total_views)} views</span>
                  <span>{formatNumber(drug.total_likes)} likes</span>
                </div>
              </div>
            ))}
            {drugsBreakdown.length === 0 && (
              <p className="text-gray-500 text-center py-4">No drug data available</p>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h3 className="text-lg font-semibold mb-4">Videos by Category</h3>
          <div className="space-y-4">
            {categoryBreakdown.map((cat) => {
              const maxCatVideos = Math.max(...categoryBreakdown.map(c => c.video_count), 1)
              return (
                <div key={cat.category} className="flex items-center gap-4">
                  <div className="w-24">
                    <span className={`text-xs px-2 py-1 rounded ${CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.unknown}`}>
                      {cat.category}
                    </span>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-800 rounded-full transition-all"
                        style={{ width: `${(cat.video_count / maxCatVideos) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-20">
                      {cat.video_count} videos
                    </span>
                  </div>
                  <div className="w-20 text-right text-xs text-gray-500">
                    {formatNumber(cat.total_views)} views
                  </div>
                </div>
              )
            })}
            {categoryBreakdown.length === 0 && (
              <p className="text-gray-500 text-center py-4">No category data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Videos */}
      <div className="bg-white rounded-xl shadow-sm p-6 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Classified Videos</h3>
          <Link
            href="/tiktok/videos"
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            View all videos →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentVideos.map((video) => (
            <a
              key={video.video_id}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Video Placeholder */}
              <div className="bg-gray-800 h-32 flex items-center justify-center relative">
                <svg className="w-10 h-10 text-white opacity-60" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {video.substance_use_confidence && (
                  <span className={`absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded ${getConfidenceColor(video.substance_use_confidence)}`}>
                    {Math.round(video.substance_use_confidence * 100)}%
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                  {video.description || 'No description'}
                </p>
                <div className="flex items-center justify-end">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[drugsBreakdown.find(d => d.scientific_name === video.scientific_name)?.category || 'unknown'] || CATEGORY_COLORS.unknown}`}>
                    {video.scientific_name}
                  </span>
                </div>
                <div className="flex gap-2 mt-2 text-xs text-gray-400">
                  <span>{formatNumber(video.view_count)} views</span>
                  <span>{formatNumber(video.like_count)} likes</span>
                </div>
              </div>
            </a>
          ))}
          {recentVideos.length === 0 && (
            <p className="text-gray-500 text-center py-4 col-span-4">No recent videos available</p>
          )}
        </div>
      </div>

          {/* Daily Trends Line Chart */} 
      <div className="bg-white rounded-xl shadow-sm p-6 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Daily Trends</h3>
          <div className="flex flex-wrap gap-2">
            {drugsBreakdown.slice(0, 8).map((drug, idx) => (
              <button
                key={drug.scientific_name}
                onClick={() => toggleDrug(drug.scientific_name)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  selectedDrugs.includes(drug.scientific_name)
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
                style={{
                  backgroundColor: selectedDrugs.includes(drug.scientific_name)
                    ? COLORS[idx % COLORS.length]
                    : undefined
                }}
              >
                {drug.scientific_name}
              </button> 
            ))}
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={getLineChartData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 11 }}
                interval={Math.max(0, Math.floor(getLineChartData().length / 12) - 1)}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                domain={['dataMin', 'dataMax']}
                allowDataOverflow={false}
                tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}
              />
              <Tooltip />
              {/*<Legend />*/}
              {selectedDrugs.slice(0, 8).map((drug) => (
                <Line
                  key={drug}
                  type="monotone"
                  dataKey={drug}
                  stroke={COLORS[topDrugs.findIndex(d => d.scientific_name === drug) % COLORS.length]}                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))} 
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
