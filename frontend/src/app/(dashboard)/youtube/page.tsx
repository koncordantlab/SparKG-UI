'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

// Multi-color palette for time series chart (keep original colors for readability)
const LINE_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6']

interface WeeklyData {
  date: string
  scientific_name: string
  mentions: number
  total_views: number
  total_likes: number
  total_comments: number
}

interface TopDrug {
  scientific_name: string
  mentions: number
  total_views: number
}

interface CategoryData {
  category: string
  total_mentions: number
}

// Month name mapping
const monthNames: Record<string, string> = {
  '01': 'January',
  '02': 'February',
  '03': 'March',
  '04': 'April',
  '05': 'May',
  '06': 'June',
  '07': 'July',
  '08': 'August',
  '09': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December',
}

export default function YouTubeDashboard() {
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([])
  const [filteredData, setFilteredData] = useState<WeeklyData[]>([])
  const [topDrugs, setTopDrugs] = useState<TopDrug[]>([])
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [stats, setStats] = useState({ total_videos: 0, total_views: 0, total_likes: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedDrugs, setSelectedDrugs] = useState<string[]>([])

  // Date filters
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  // Extract available years from data (date format: "2025-01-15")
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    weeklyData.forEach(d => {
      const year = d.date?.split('-')[0]
      if (year) years.add(year)
    })
    return Array.from(years).sort().reverse()
  }, [weeklyData])

  // Extract available months for selected year
  const availableMonths = useMemo(() => {
    if (!selectedYear) return []
    const months = new Set<string>()
    weeklyData
      .filter(d => d.date?.startsWith(selectedYear))
      .forEach(d => {
        const month = d.date?.split('-')[1]
        if (month) months.add(month)
      })
    return Array.from(months).sort()
  }, [weeklyData, selectedYear])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    filterData()
  }, [weeklyData, selectedYear, selectedMonth])

  const loadData = async () => {
    try {
      setLoading(true)

      // Fetch weekly trends for YouTube (fetch all available data)
      const trendsRes = await fetch(`/api/v1/dashboard/trends/weekly?platform=youtube&weeks=104`)
      const trendsData = await trendsRes.json()
      setWeeklyData(trendsData)

      // Fetch category distribution
      const catRes = await fetch('/api/v1/dashboard/overview/category-distribution')
      const catData = await catRes.json()
      setCategories(catData)
    } catch (err) {
      console.error('Failed to load YouTube data:', err)
    } finally {
      setLoading(false)
    }
  }

  const filterData = () => {
    let data = [...weeklyData]

    // Filter by year (date format: "2025-01-15")
    if (selectedYear) {
      data = data.filter(d => d.date?.startsWith(selectedYear.toString()))
    }

    // Filter by month
    if (selectedMonth) {
      data = data.filter(d => {
        const month = d.date?.split('-')[1]
        return month === selectedMonth
      })
    }

    setFilteredData(data)

    // Recalculate stats and top drugs based on filtered data
    const drugMentions = data.reduce((acc: Record<string, { mentions: number, views: number }>, item: WeeklyData) => {
      if (!acc[item.scientific_name]) {
        acc[item.scientific_name] = { mentions: 0, views: 0 }
      }
      acc[item.scientific_name].mentions += item.mentions
      acc[item.scientific_name].views += item.total_views || 0
      return acc
    }, {})

    const topDrugNames = Object.entries(drugMentions)
      .sort(([,a], [,b]) => b.mentions - a.mentions)
      .slice(0, 5)
      .map(([name]) => name)

    if (selectedDrugs.length === 0 || !selectedDrugs.some(d => topDrugNames.includes(d))) {
      setSelectedDrugs(topDrugNames)
    }

    const topDrugsCalc = Object.entries(drugMentions)
      .map(([name, data]) => ({
        scientific_name: name,
        mentions: data.mentions,
        total_views: data.views
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 10)
    setTopDrugs(topDrugsCalc)

    const totalStats = data.reduce((acc: typeof stats, item: WeeklyData) => ({
      total_videos: acc.total_videos + item.mentions,
      total_views: acc.total_views + (item.total_views || 0),
      total_likes: acc.total_likes + (item.total_likes || 0)
    }), { total_videos: 0, total_views: 0, total_likes: 0 })
    setStats(totalStats)
  }

  // Format date string (e.g., "2025-01-15") to display format
  // Parse manually to avoid timezone issues with Date constructor
  const formatDateLabel = (dateStr: string): string => {
    if (!dateStr) return ''
    const [, month, day] = dateStr.split('-').map(Number)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[month - 1]} ${day}`
  }

  // Transform daily data for line chart
  const getLineChartData = () => {
    const dateMap: Record<string, Record<string, number | string>> = {}

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

  const formatNumber = (num: number) => {
    if (!num) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const toggleDrug = (drug: string) => {
    setSelectedDrugs(prev =>
      prev.includes(drug)
        ? prev.filter(d => d !== drug)
        : [...prev, drug]
    )
  }

  const clearFilters = () => {
    setSelectedYear('')
    setSelectedMonth('')
  }

  // Calculate max for category bars
  const maxCategoryMentions = Math.max(...categories.map(c => c.total_mentions), 1)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading YouTube analytics...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">YouTube Dashboard</h1>
        <p className="text-gray-500">Drug mention analytics from YouTube videos</p>
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
                setSelectedMonth('')
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
              {availableMonths.map(month => (
                <option key={month} value={month}>{monthNames[month]}</option>
              ))}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Videos</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_videos)}</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Views</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_views)}</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Likes</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_likes)}</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Drugs */}
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h3 className="text-lg font-semibold mb-4">Top Mentioned Drugs</h3>
          <div className="space-y-3">
            {topDrugs.map((drug) => {
              const maxMentions = Math.max(...topDrugs.map(d => d.mentions), 1)
              return (
                <div key={drug.scientific_name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{drug.scientific_name}</span>
                    <span className="text-sm text-gray-500">{formatNumber(drug.mentions)} mentions</span>
                  </div>
                  <div className="h-3 bg-red-50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full transition-all"
                      style={{ width: `${(drug.mentions / maxMentions) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {topDrugs.length === 0 && (
              <p className="text-gray-500 text-center py-4">No drug data available</p>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h3 className="text-lg font-semibold mb-4">Drug Categories</h3>
          <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 capitalize">{cat.category}</span>
                  <span className="text-sm text-gray-500">{formatNumber(cat.total_mentions)} mentions</span>
                </div>
                <div className="h-3 bg-red-50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded-full transition-all"
                    style={{ width: `${(cat.total_mentions / maxCategoryMentions) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-gray-500 text-center py-4">No category data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Daily Trends Line Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Daily Trends</h3>
          <div className="flex flex-wrap gap-2">
            {topDrugs.slice(0, 8).map((drug, idx) => (
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
                    ? LINE_COLORS[idx % LINE_COLORS.length]
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
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis
                domain={['dataMin', 'dataMax']}
                allowDataOverflow={false}
                tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value}
              />
              <Tooltip />
              <Legend />
              {selectedDrugs.map((drug) => (
                <Line
                  key={drug}
                  type="monotone"
                  dataKey={drug}
                  stroke={LINE_COLORS[topDrugs.findIndex(d => d.scientific_name === drug) % LINE_COLORS.length]}
                  strokeWidth={2}
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
