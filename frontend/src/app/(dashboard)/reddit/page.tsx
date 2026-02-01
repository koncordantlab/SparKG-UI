'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6']

interface DailyData {
  date: string
  scientific_name: string
  mentions: number
  total_engagement: number
  total_comments: number
}

interface TopDrug {
  scientific_name: string
  mentions: number
  total_score: number
}

interface SubredditData {
  subreddit: string
  total_posts: number
  total_score: number
}

// Month options
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

export default function RedditDashboard() {
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [filteredData, setFilteredData] = useState<DailyData[]>([])
  const [topDrugs, setTopDrugs] = useState<TopDrug[]>([])
  const [subreddits, setSubreddits] = useState<SubredditData[]>([])
  const [stats, setStats] = useState({ total_posts: 0, total_score: 0, total_comments: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedDrugs, setSelectedDrugs] = useState<string[]>([])

  // Date filters
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')

  // Extract available years from data (date format: "2026-01-02")
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

      // Fetch all available daily trends
      const trendsRes = await fetch('/api/v1/dashboard/trends/weekly?platform=reddit&weeks=104')
      const trendsData = await trendsRes.json()
      setDailyData(trendsData)

      // Fetch subreddits
      const subRes = await fetch('/api/v1/dashboard/filters/subreddits?limit=10')
      const subData = await subRes.json()
      setSubreddits(subData)
    } catch (err) {
      console.error('Failed to load Reddit data:', err)
    } finally {
      setLoading(false)
    }
  }

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
          .reduce((sum: number, d: DailyData) => sum + (d.total_engagement || 0), 0)
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 10)
    setTopDrugs(topDrugsCalc)

    const totalStats = data.reduce((acc: typeof stats, item: DailyData) => ({
      total_posts: acc.total_posts + item.mentions,
      total_score: acc.total_score + (item.total_engagement || 0),
      total_comments: acc.total_comments + (item.total_comments || 0)
    }), { total_posts: 0, total_score: 0, total_comments: 0 })
    setStats(totalStats)
  }

  // Format date string (e.g., "2026-01-02") to display format
  // Parse manually to avoid timezone issues with Date constructor
  const formatDateLabel = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading Reddit analytics...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reddit Dashboard</h1>
        <p className="text-gray-500">Drug mention analytics from Reddit posts</p>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Posts</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_posts)}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Score</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_score)}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Comments</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_comments)}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Drugs Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h3 className="text-lg font-semibold mb-4">Top Mentioned Drugs</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDrugs} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="scientific_name" type="category" width={80} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="mentions" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Subreddits Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h3 className="text-lg font-semibold mb-4">Top Subreddits</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subreddits}
                  dataKey="total_posts"
                  nameKey="subreddit"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ subreddit, percent }) => `r/${subreddit} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {subreddits.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNumber(value as number)} />
              </PieChart>
            </ResponsiveContainer>
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
                interval={0}
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
              <Legend />
              {selectedDrugs.map((drug) => (
                <Line
                  key={drug}
                  type="monotone"
                  dataKey={drug}
                  stroke={COLORS[topDrugs.findIndex(d => d.scientific_name === drug) % COLORS.length]}
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
