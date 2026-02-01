'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

interface YouTubeVideo {
  video_id: string
  title: string
  channel_title: string
  view_count: number
  like_count: number
  comment_count: number
  duration_seconds: number
  is_short: boolean
  published_at: string
  url: string
  scientific_name: string
}

export default function YouTubeVideosPage() {
  const searchParams = useSearchParams()
  const drugFromUrl = searchParams.get('drug') || ''

  const [videos, setVideos] = useState<YouTubeVideo[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [drugs, setDrugs] = useState<string[]>([])

  // Filters - initialize selectedDrug from URL parameter
  const [selectedDrug, setSelectedDrug] = useState(drugFromUrl)
  const [days, setDays] = useState(30)

  // Drug search dropdown
  const [drugSearch, setDrugSearch] = useState('')
  const [drugDropdownOpen, setDrugDropdownOpen] = useState(false)
  const drugDropdownRef = useRef<HTMLDivElement>(null)

  // Filter drugs based on search
  const filteredDrugs = drugs.filter(drug =>
    drug.toLowerCase().includes(drugSearch.toLowerCase())
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drugDropdownRef.current && !drugDropdownRef.current.contains(event.target as Node)) {
        setDrugDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const limit = 20

  useEffect(() => {
    loadFilters()
  }, [])

  useEffect(() => {
    loadVideos()
  }, [page, selectedDrug, days])

  const loadFilters = async () => {
    try {
      // Load drugs actually found in YouTube videos (reduced list)
      const drugRes = await fetch('/api/v1/dashboard/filters/youtube-drugs?limit=500')
      const drugData = await drugRes.json()
      setDrugs(drugData?.map((d: { scientific_name: string }) => d.scientific_name) || [])
    } catch (err) {
      console.error('Failed to load filters:', err)
    }
  }

  const loadVideos = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
        days: days.toString()
      })
      if (selectedDrug) params.append('drug', selectedDrug)

      const res = await fetch(`/api/v1/dashboard/posts/youtube?${params}`)
      const data = await res.json()
      setVideos(data.posts || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Failed to load videos:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    })
  }

  const formatNumber = (num: number) => {
    if (!num) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">YouTube Videos</h1>
        <p className="text-gray-500">Browse and filter YouTube videos mentioning drugs</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative" ref={drugDropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Drug</label>
            <div
              className="w-full border rounded-lg px-3 py-2 cursor-pointer bg-white flex items-center justify-between"
              onClick={() => setDrugDropdownOpen(!drugDropdownOpen)}
            >
              <span className={selectedDrug ? 'text-gray-900' : 'text-gray-500'}>
                {selectedDrug || 'All drugs'}
              </span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {drugDropdownOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-80 overflow-hidden">
                <div className="p-2 border-b">
                  <input
                    type="text"
                    placeholder="Search drugs..."
                    value={drugSearch}
                    onChange={(e) => setDrugSearch(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <div
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${!selectedDrug ? 'bg-red-50 text-red-700' : ''}`}
                    onClick={() => { setSelectedDrug(''); setPage(0); setDrugDropdownOpen(false); setDrugSearch('') }}
                  >
                    All drugs
                  </div>
                  {filteredDrugs.map(drug => (
                    <div
                      key={drug}
                      className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${selectedDrug === drug ? 'bg-red-50 text-red-700' : ''}`}
                      onClick={() => { setSelectedDrug(drug); setPage(0); setDrugDropdownOpen(false); setDrugSearch('') }}
                    >
                      {drug}
                    </div>
                  ))}
                  {filteredDrugs.length === 0 && (
                    <div className="px-3 py-2 text-gray-500 text-sm">No drugs found</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
            <select
              value={days}
              onChange={(e) => { setDays(Number(e.target.value)); setPage(0) }}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => { setSelectedDrug(''); setDays(30); setPage(0) }}
              className="w-full px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-gray-500">
        Showing {videos.length} of {formatNumber(total)} videos
      </div>

      {/* Videos Grid */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading videos...</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No videos found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map(video => (
            <div key={video.video_id} className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow">
              {/* Header with drug tag and duration */}
              <div className="flex items-center justify-between mb-3">
                {video.scientific_name && (
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    {video.scientific_name}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  {video.is_short && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                      Short
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {formatDuration(video.duration_seconds)}
                  </span>
                </div>
              </div>

              {/* Title */}
              <p className="text-sm text-gray-900 line-clamp-3 mb-3">
                {video.title}
              </p>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {formatNumber(video.view_count)}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {formatNumber(video.like_count)}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {formatNumber(video.comment_count)}
                </span>
                <span className="ml-auto">{formatDate(video.published_at)}</span>
              </div>

              {/* Action button */}
              <div className="flex gap-2">
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  YouTube
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-gray-600">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
