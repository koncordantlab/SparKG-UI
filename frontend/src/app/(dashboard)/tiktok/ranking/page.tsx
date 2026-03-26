'use client'

import { useState, useEffect } from 'react'

interface RankedPost {
  doc_id: string
  rank: number
  lambdamart_score: number
  anchor_canon: string
  detected_drugs: string
  relevance: number | null
  confidence: number | null
  reasoning_short: string | null
}

const RELEVANCE_LABELS: Record<number, string> = {
  0: 'Not Relevant',
  1: 'Education/News',
  2: 'Implied Misuse',
  3: 'Explicit Misuse',
}

const RELEVANCE_BADGE: Record<number, string> = {
  0: 'bg-gray-100 text-gray-700',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-amber-100 text-amber-700',
  3: 'bg-red-100 text-red-700',
}

export default function TikTokRankingPage() {
  const [posts, setPosts] = useState<RankedPost[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const limit = 20

  const [annotatedFilter, setAnnotatedFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [expandedPost, setExpandedPost] = useState<string | null>(null)

  useEffect(() => {
    loadPosts()
  }, [page, annotatedFilter])

  const loadPosts = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      })
      if (annotatedFilter !== 'all') params.append('annotated', annotatedFilter)
      const res = await fetch(`/api/v1/ranking/posts?${params}`)
      const data = await res.json()
      setPosts(data.posts || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('Failed to load posts:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    if (!num) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ranking Evaluation</h1>
        <p className="text-gray-500">LambdaMART ranked posts with GPT relevance annotations</p>
      </div>

      {/* Posts List */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            Ranked Posts
            {total > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({formatNumber(total)} total)
              </span>
            )}
          </h3>
          <div className="flex rounded-lg border overflow-hidden text-sm">
            {(['all', 'yes', 'no'] as const).map((value) => (
              <button
                key={value}
                onClick={() => { setAnnotatedFilter(value); setPage(0) }}
                className={`px-3 py-1.5 ${annotatedFilter === value ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {value === 'all' ? 'All' : value === 'yes' ? 'Annotated' : 'Not Annotated'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading posts...</div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No posts found</div>
        ) : (
          <div className="divide-y">
            {posts.map((post) => {
              const isExpanded = expandedPost === post.doc_id
              const tiktokId = post.doc_id.replace('tiktok:', '')

              return (
                <div key={post.doc_id} className="p-4">
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => setExpandedPost(isExpanded ? null : post.doc_id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          #{post.rank}
                        </span>
                        {post.anchor_canon && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {post.anchor_canon}
                          </span>
                        )}
                        {post.relevance !== null ? (
                          <span className={`text-xs px-2 py-0.5 rounded ${RELEVANCE_BADGE[post.relevance]}`}>
                            {RELEVANCE_LABELS[post.relevance]}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-50 text-gray-400">
                            Not annotated
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-mono text-gray-700">
                        {post.doc_id}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Score: {post.lambdamart_score.toFixed(5)}</span>
                        {post.confidence !== null && (
                          <span>Confidence: {(post.confidence * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t bg-gradient-to-b from-blue-50 to-white -mx-4 px-4 pb-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="bg-blue-100 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wide">Rank</p>
                          <p className="text-sm font-medium text-blue-900">#{post.rank}</p>
                        </div>

                        <div className="bg-blue-100 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wide">LambdaMART Score</p>
                          <p className="text-sm font-medium text-blue-900">{post.lambdamart_score.toFixed(5)}</p>
                        </div>

                        <div className="bg-blue-100 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wide">Relevance</p>
                          <p className="text-sm font-medium text-blue-900">
                            {post.relevance !== null ? `${post.relevance} - ${RELEVANCE_LABELS[post.relevance]}` : 'Not annotated'}
                          </p>
                        </div>

                        <div className="bg-blue-100 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wide">Confidence</p>
                          <p className="text-sm font-medium text-blue-900">
                            {post.confidence !== null ? `${(post.confidence * 100).toFixed(0)}%` : 'N/A'}
                          </p>
                        </div>
                      </div>

                      {post.reasoning_short && (
                        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wide">GPT Reasoning</p>
                          <p className="text-sm text-blue-900 leading-relaxed">
                            {post.reasoning_short}
                          </p>
                        </div>
                      )}

                      <a
                        href={`https://www.tiktok.com/@/video/${tiktokId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors"
                      >
                        View on TikTok
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t">
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
    </div>
  )
}
