'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

interface RedditPost {
  id: string
  title: string
  subreddit: string
  author: string
  score: number
  num_comments: number
  created_utc: string
  url: string
  scientific_name: string
  substance_use_confidence: number
}

interface Subreddit {
  subreddit: string
  total_posts: number
}

export default function RedditPostsPage() {
  const searchParams = useSearchParams()
  const drugFromUrl = searchParams.get('drug') || ''

  const [posts, setPosts] = useState<RedditPost[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [subreddits, setSubreddits] = useState<Subreddit[]>([])
  const [drugs, setDrugs] = useState<string[]>([])

  // Filters - initialize selectedDrug from URL parameter
  const [selectedDrug, setSelectedDrug] = useState(drugFromUrl)
  const [selectedSubreddit, setSelectedSubreddit] = useState('')
  const [days, setDays] = useState(365) // Default to 1 year when coming from drug link

  // Drug search
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
    loadPosts()
  }, [page, selectedDrug, selectedSubreddit, days])

  const loadFilters = async () => {
    try {
      // Load subreddits
      const subRes = await fetch('/api/v1/dashboard/filters/subreddits?limit=50')
      const subData = await subRes.json()
      setSubreddits(subData)

      // Load drugs from actual classified Reddit posts
      const drugRes = await fetch('/api/v1/dashboard/filters/reddit-drugs?limit=500')
      const drugData = await drugRes.json()
      setDrugs(drugData.map((d: { scientific_name: string }) => d.scientific_name))
    } catch (err) {
      console.error('Failed to load filters:', err)
    }
  }

  const loadPosts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
        days: days.toString()
      })
      if (selectedDrug) params.append('drug', selectedDrug)
      if (selectedSubreddit) params.append('subreddit', selectedSubreddit)

      const res = await fetch(`/api/v1/dashboard/posts/reddit?${params}`)
      const data = await res.json()
      setPosts(data.posts)
      setTotal(data.total)
    } catch (err) {
      console.error('Failed to load posts:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatNumber = (num: number) => {
    if (!num) return '0'
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reddit Posts</h1>
        <p className="text-gray-500">Browse and filter Reddit posts mentioning drugs</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <div
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${!selectedDrug ? 'bg-blue-50 text-blue-700' : ''}`}
                    onClick={() => { setSelectedDrug(''); setPage(0); setDrugDropdownOpen(false); setDrugSearch('') }}
                  >
                    All drugs
                  </div>
                  {filteredDrugs.map(drug => (
                    <div
                      key={drug}
                      className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${selectedDrug === drug ? 'bg-blue-50 text-blue-700' : ''}`}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Subreddit</label>
            <select
              value={selectedSubreddit}
              onChange={(e) => { setSelectedSubreddit(e.target.value); setPage(0) }}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">All subreddits</option>
              {subreddits.map(sub => (
                <option key={sub.subreddit} value={sub.subreddit}>r/{sub.subreddit}</option>
              ))}
            </select>
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
              onClick={() => { setSelectedDrug(''); setSelectedSubreddit(''); setDays(30); setPage(0) }}
              className="w-full px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-gray-500">
        Showing {posts.length} of {formatNumber(total)} posts
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No posts found</div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-xl shadow-sm p-4 border hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                {/* Confidence Score */}
                <div className="flex flex-col items-center min-w-[50px] text-center">
                  <span className="text-lg font-medium text-gray-700">
                    {Math.round(post.substance_use_confidence * 100)}%
                  </span>
                  <span className="text-xs text-gray-400">confidence</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
                  >
                    {post.title}
                  </a>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                      r/{post.subreddit}
                    </span>
                    <span>{formatDate(post.created_utc)}</span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      {post.num_comments} comments
                    </span>
                  </div>

                  {post.scientific_name && (
                    <div className="mt-2">
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                        {post.scientific_name}
                      </span>
                    </div>
                  )}
                </div>
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
