'use client'

import { useState, useEffect } from 'react'

interface BehaviorCount {
  setting?: string
  state?: string
  reinforcement?: string
  outcome?: string
  count: number
}

interface FilterOptions {
  settings: string[]
  behaviors: string[]
  states: string[]
  reinforcement: string[]
  outcomes: string[]
}

interface Video {
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
  behavior_identified: string
  annotation_definition: string
  annotation_reasoning: string
  intent: string
  behavior_type: string
  state: string
  reinforcement_pattern: string
  outcome: string
}

const CARD_COLORS = {
  settings: 'bg-slate-700',
  states: 'bg-slate-600',
  reinforcement: 'bg-slate-700',
  outcomes: 'bg-slate-600',
}

export default function TikTokBehaviorPage() {
  const [settings, setSettings] = useState<BehaviorCount[]>([])
  const [states, setStates] = useState<BehaviorCount[]>([])
  const [reinforcement, setReinforcement] = useState<BehaviorCount[]>([])
  const [outcomes, setOutcomes] = useState<BehaviorCount[]>([])
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    settings: [],
    behaviors: [],
    states: [],
    reinforcement: [],
    outcomes: [],
  })
  const [videos, setVideos] = useState<Video[]>([])
  const [totalVideos, setTotalVideos] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingVideos, setLoadingVideos] = useState(false)
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const limit = 20

  // Filter states
  const [selectedSetting, setSelectedSetting] = useState('')
  const [selectedBehavior, setSelectedBehavior] = useState('')
  const [selectedState, setSelectedState] = useState('')
  const [selectedReinforcement, setSelectedReinforcement] = useState('')
  const [selectedOutcome, setSelectedOutcome] = useState('')

  useEffect(() => {
    loadBehaviorData()
    loadFilterOptions()
  }, [])

  useEffect(() => {
    setPage(0)
    loadFilteredVideos(0)
  }, [selectedSetting, selectedBehavior, selectedState, selectedReinforcement, selectedOutcome])

  useEffect(() => {
    loadFilteredVideos(page)
  }, [page])

  const loadBehaviorData = async () => {
    try {
      setLoading(true)
      const [settingsRes, statesRes, reinforcementRes, outcomesRes] = await Promise.all([
        fetch('/api/v1/dashboard/tiktok/behavior/settings'),
        fetch('/api/v1/dashboard/tiktok/behavior/states'),
        fetch('/api/v1/dashboard/tiktok/behavior/reinforcement'),
        fetch('/api/v1/dashboard/tiktok/behavior/outcomes'),
      ])

      const [settingsData, statesData, reinforcementData, outcomesData] = await Promise.all([
        settingsRes.json(),
        statesRes.json(),
        reinforcementRes.json(),
        outcomesRes.json(),
      ])

      setSettings(settingsData || [])
      setStates(statesData || [])
      setReinforcement(reinforcementData || [])
      setOutcomes(outcomesData || [])
    } catch (err) {
      console.error('Failed to load behavior data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadFilterOptions = async () => {
    try {
      const res = await fetch('/api/v1/dashboard/tiktok/behavior/filters')
      const data = await res.json()
      setFilterOptions({
        settings: data.settings || [],
        behaviors: data.behaviors || [],
        states: data.states || [],
        reinforcement: data.reinforcement || [],
        outcomes: data.outcomes || [],
      })
    } catch (err) {
      console.error('Failed to load filter options:', err)
    }
  }

  const loadFilteredVideos = async (currentPage: number) => {
    try {
      setLoadingVideos(true)
      const params = new URLSearchParams()
      params.append('limit', limit.toString())
      params.append('offset', (currentPage * limit).toString())
      if (selectedSetting) params.append('setting', selectedSetting)
      if (selectedBehavior) params.append('behavior', selectedBehavior)
      if (selectedState) params.append('state', selectedState)
      if (selectedReinforcement) params.append('reinforcement', selectedReinforcement)
      if (selectedOutcome) params.append('outcome', selectedOutcome)

      const res = await fetch(`/api/v1/dashboard/tiktok/behavior/videos?${params}`)
      const data = await res.json()
      setVideos(data.videos || [])
      setTotalVideos(data.total || 0)
    } catch (err) {
      console.error('Failed to load videos:', err)
    } finally {
      setLoadingVideos(false)
    }
  }

  const formatNumber = (num: number) => {
    if (!num) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString()
  }

  const clearFilters = () => {
    setSelectedSetting('')
    setSelectedBehavior('')
    setSelectedState('')
    setSelectedReinforcement('')
    setSelectedOutcome('')
  }

  const hasActiveFilters = selectedSetting || selectedBehavior || selectedState || selectedReinforcement || selectedOutcome
  const totalPages = Math.ceil(totalVideos / limit)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading behavior analytics...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">TikTok Behavioral Analysis</h1>
        <p className="text-gray-500">Behavioral patterns identified in substance-related TikTok videos</p>
      </div>

      {/* Behavior Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Top Behavioral Settings */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className={`${CARD_COLORS.settings} text-white px-4 py-3`}>
            <h3 className="font-semibold">Top Behavioral Settings</h3>
          </div>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {settings.length > 0 ? (
              settings.slice(0, 8).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 truncate flex-1 mr-2">{item.setting}</span>
                  <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {item.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No data available</p>
            )}
          </div>
        </div>

        {/* Psychological States */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className={`${CARD_COLORS.states} text-white px-4 py-3`}>
            <h3 className="font-semibold">Psychological States</h3>
          </div>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {states.length > 0 ? (
              states.slice(0, 8).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 truncate flex-1 mr-2">{item.state}</span>
                  <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {item.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No data available</p>
            )}
          </div>
        </div>

        {/* Reinforcement Patterns */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className={`${CARD_COLORS.reinforcement} text-white px-4 py-3`}>
            <h3 className="font-semibold">Reinforcement Patterns</h3>
          </div>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {reinforcement.length > 0 ? (
              reinforcement.slice(0, 8).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 truncate flex-1 mr-2">{item.reinforcement}</span>
                  <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {item.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No data available</p>
            )}
          </div>
        </div>

        {/* Behavioral Outcomes */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className={`${CARD_COLORS.outcomes} text-white px-4 py-3`}>
            <h3 className="font-semibold">Behavioral Outcomes</h3>
          </div>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {outcomes.length > 0 ? (
              outcomes.slice(0, 8).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 truncate flex-1 mr-2">{item.outcome}</span>
                  <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {item.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Filter Videos by Behavior</h3>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all filters
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Setting</label>
            <select
              value={selectedSetting}
              onChange={(e) => setSelectedSetting(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Settings</option>
              {(filterOptions.settings || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Behavior Type</label>
            <select
              value={selectedBehavior}
              onChange={(e) => setSelectedBehavior(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Types</option>
              {(filterOptions.behaviors || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All States</option>
              {(filterOptions.states || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reinforcement</label>
            <select
              value={selectedReinforcement}
              onChange={(e) => setSelectedReinforcement(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Reinforcement</option>
              {(filterOptions.reinforcement || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
            <select
              value={selectedOutcome}
              onChange={(e) => setSelectedOutcome(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Outcomes</option>
              {(filterOptions.outcomes || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filtered Videos */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              Filtered Videos
              {totalVideos > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({totalVideos} total)
                </span>
              )}
            </h3>
          </div>
        </div>

        {loadingVideos ? (
          <div className="p-8 text-center text-gray-500">Loading videos...</div>
        ) : videos.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {hasActiveFilters
              ? 'No videos match the selected filters'
              : 'No annotated videos found'}
          </div>
        ) : (
          <div className="divide-y">
            {videos.map((video) => (
              <div key={video.video_id} className="p-4">
                <div
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => setExpandedVideo(expandedVideo === video.video_id ? null : video.video_id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 truncate">
                        @{video.author_username || 'unknown'}
                      </span>
                      {video.scientific_name && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {video.scientific_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {video.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{formatNumber(video.view_count)} views</span>
                      <span>{formatNumber(video.like_count)} likes</span>
                      <span>{formatNumber(video.comment_count)} comments</span>
                      <span>{formatDate(video.published_at)}</span>
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedVideo === video.video_id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {expandedVideo === video.video_id && (
                  <div className="mt-4 pt-4 border-t bg-gradient-to-b from-slate-50 to-white -mx-4 px-4 pb-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                      {video.intent && (
                        <div className="bg-purple-100 border border-purple-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-purple-600 mb-1 uppercase tracking-wide">Intent</p>
                          <p className="text-sm font-medium text-purple-900">
                            {video.intent}
                          </p>
                        </div>
                      )}
                      {video.behavior_type && (
                        <div className="bg-blue-100 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wide">Behavior Type</p>
                          <p className="text-sm font-medium text-blue-900">
                            {video.behavior_type}
                          </p>
                        </div>
                      )}
                      {video.state && (
                        <div className="bg-amber-100 border border-amber-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-amber-600 mb-1 uppercase tracking-wide">State</p>
                          <p className="text-sm font-medium text-amber-900">
                            {video.state}
                          </p>
                        </div>
                      )}
                      {video.reinforcement_pattern && (
                        <div className="bg-emerald-100 border border-emerald-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-emerald-600 mb-1 uppercase tracking-wide">Reinforcement</p>
                          <p className="text-sm font-medium text-emerald-900">
                            {video.reinforcement_pattern}
                          </p>
                        </div>
                      )}
                      {video.outcome && (
                        <div className="bg-rose-100 border border-rose-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-rose-600 mb-1 uppercase tracking-wide">Outcome</p>
                          <p className="text-sm font-medium text-rose-900">
                            {video.outcome}
                          </p>
                        </div>
                      )}
                    </div>
                    {video.annotation_definition && (
                      <div className="mb-4 bg-slate-100 border border-slate-200 rounded-lg p-4">
                        <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Annotation Definition</p>
                        <p className="text-sm text-slate-800 leading-relaxed">
                          {video.annotation_definition}
                        </p>
                      </div>
                    )}
                    {video.url && (
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors"
                      >
                        View on TikTok
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
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
