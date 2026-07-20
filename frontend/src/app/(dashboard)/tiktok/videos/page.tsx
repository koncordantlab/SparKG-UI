'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface TikTokVideo {
  video_id: string
  description: string
  author_username: string
  author_display_name: string
  view_count: number
  like_count: number
  comment_count: number
  share_count: number
  published_at: string
  url: string
  scientific_name: string
  substance_use_confidence?: number
  transcript?: string
}

interface PipelineStage {
  stage_id: string
  title: string
  status: string
  headline: string
  details: string[]
  confidence: number | null
}

interface DrugProperty {
  matched_surface_term: string
  canonical_drug_name: string
  confidence: number
  needs_human_validation: boolean
  context_snippet: string
  properties: {
    name: string
    pharmacology: string
    legal_status: string
    known_synonyms: string[]
    pubchem_cid: string
  }
}

interface LabelAssignment {
  auto_label: number | null
  auto_label_text: string | null
  model_label: number | null
  rule_label: number | null
  llm_label: number | null
  llm_status: string | null
  disagreement_flag: boolean | null
  uncertainty_entropy: number | null
  active_learning_priority: number | null
}

interface EducationRecommendation {
  recommendation_id?: string
  resource_title?: string
  title?: string
  resource_category?: string
  safe_summary?: string
  content?: string
  prd_education_score?: number
  rank_for_candidate?: number
  education_action_status?: string
  requires_human_review_before_showing?: boolean
}

interface EducationSession {
  recommendations?: EducationRecommendation[]
  actions?: EducationRecommendation[]
  top_action?: string | null
  display_rule?: string
}

interface SponsorStory {
  video: { video_id: string; url: string; availability_status: string }
  summary_columns: Record<string, unknown>
  sponsor_explanation: {
    plain_language_finding: string
    why_it_matters: string
    review_message: string
    education_message: string
  }
  pipeline_stages: PipelineStage[]
  drug_properties: DrugProperty[]
  label_assignment: LabelAssignment
  oav_triples: Array<{ triple_id: string; subject: string; predicate: string; object: string }>
  ontology_mappings: Array<{ term: string; uri?: string }>
  education_session: EducationSession | null
  validation: { status: string; pending_review_count: number; completeness_score: number }
}

const STATUS_STYLES: Record<string, string> = {
  complete: 'bg-green-100 text-green-700',
  review_required: 'bg-yellow-100 text-yellow-700',
  not_available_yet: 'bg-gray-100 text-gray-500',
  pending: 'bg-blue-100 text-blue-700',
}

const STATUS_DOT: Record<string, string> = {
  complete: 'bg-green-500',
  review_required: 'bg-yellow-500',
  not_available_yet: 'bg-gray-400',
  pending: 'bg-blue-500',
}

function labelDisplay(val: number | null | string, status?: string | null): string {
  if (val === null || val === undefined) {
    if (status === 'not_run_for_this_video') return 'Not run'
    if (status === 'preview') return 'Preview available'
    if (status) return status.replace(/_/g, ' ')
    return 'N/A'
  }
  return String(val)
}

function EducationSection({ edu, message }: { edu: EducationSession | null; message: string }) {
  const items = edu?.recommendations || edu?.actions || []
  if (!edu || items.length === 0) {
    return (
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-500 italic">
        {message || 'No education recommendation attached yet.'}
      </div>
    )
  }
  return (
    <div className="space-y-3 mt-2">
      {edu.display_rule && (
        <p className="text-xs text-gray-400 italic">{edu.display_rule}</p>
      )}
      {items.map((rec, i) => {
        const title = rec.resource_title || rec.title || 'Untitled'
        const category = rec.resource_category || 'support'
        const summary = rec.safe_summary || rec.content || ''
        const score = rec.prd_education_score
        return (
          <div key={rec.recommendation_id || i} className="border border-green-200 rounded-lg p-3 bg-green-50">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium bg-green-200 text-green-800 px-2 py-0.5 rounded capitalize">
                {category.replace(/_/g, ' ')}
              </span>
              {score !== undefined && score !== null && (
                <span className="text-xs text-gray-500">Score: {score.toFixed(2)}</span>
              )}
              {rec.rank_for_candidate === 1 && (
                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">#1 recommendation</span>
              )}
            </div>
            <p className="text-sm font-medium text-gray-800">{title}</p>
            {summary && <p className="text-sm text-gray-600 mt-1">{summary}</p>}
          </div>
        )
      })}
    </div>
  )
}

function EvidenceDrawer({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  const [story, setStory] = useState<SponsorStory | null>(null)
  const [eduData, setEduData] = useState<{ education_session: EducationSession | null; sponsor_education_message: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openStage, setOpenStage] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    Promise.all([
      fetch(`/api/v1/dashboard/tiktok/video-sponsor-story/${videoId}`).then(r => r.json()),
      fetch(`/api/v1/dashboard/tiktok/video-sponsor-story/${videoId}/education`).then(r => r.json()),
    ])
      .then(([s, e]) => {
        if (s.detail) { setError(s.detail); return }
        setStory(s)
        setEduData(e)
      })
      .catch(() => setError('Failed to load evidence story.'))
      .finally(() => setLoading(false))
  }, [videoId])

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Drawer panel */}
      <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-purple-700 text-white">
          <div>
            <h2 className="font-semibold text-lg">Evidence Story</h2>
            <p className="text-xs text-purple-200 mt-0.5 font-mono">{videoId}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-purple-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {loading && <div className="text-center py-12 text-gray-400">Loading evidence story…</div>}
          {error && <div className="text-center py-12 text-red-500">{error}</div>}

          {story && !loading && (
            <>
              {/* Plain-language summary */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <p className="text-sm font-medium text-purple-900">{story.sponsor_explanation?.plain_language_finding}</p>
                <p className="text-xs text-purple-700 mt-1">{story.sponsor_explanation?.why_it_matters}</p>
                {story.sponsor_explanation?.review_message && (
                  <p className="text-xs text-yellow-700 mt-2 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                    {story.sponsor_explanation.review_message}
                  </p>
                )}
              </div>

              {/* Pipeline stages */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pipeline Stages</h3>
                <div className="space-y-2">
                  {story.pipeline_stages?.map((stage) => (
                    <div key={stage.stage_id} className="border rounded-lg overflow-hidden">
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                        onClick={() => setOpenStage(openStage === stage.stage_id ? null : stage.stage_id)}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[stage.status] || 'bg-gray-400'}`} />
                        <span className="flex-1 text-sm font-medium text-gray-800">{stage.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[stage.status] || 'bg-gray-100 text-gray-500'}`}>
                          {stage.status.replace(/_/g, ' ')}
                        </span>
                        {stage.confidence !== null && (
                          <span className="text-xs text-gray-400">{Math.round(stage.confidence * 100)}%</span>
                        )}
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${openStage === stage.stage_id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {openStage === stage.stage_id && (
                        <div className="px-4 pb-3 pt-1 border-t bg-gray-50">
                          <p className="text-xs text-gray-600 font-medium mb-1">{stage.headline}</p>
                          <ul className="space-y-0.5">
                            {stage.details?.map((d, i) => (
                              <li key={i} className="text-xs text-gray-500">• {d}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Drug properties */}
              {story.drug_properties?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Drug Properties</h3>
                  {story.drug_properties.map((dp, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900">{dp.canonical_drug_name}</span>
                        {dp.needs_human_validation && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Provisional</span>
                        )}
                        <span className="ml-auto text-xs text-gray-500">{Math.round(dp.confidence * 100)}% confidence</span>
                      </div>
                      <p className="text-xs text-gray-500">Surface term: <span className="font-medium text-gray-700">"{dp.matched_surface_term}"</span></p>
                      {dp.context_snippet && (
                        <p className="text-xs bg-gray-50 border rounded px-3 py-2 text-gray-600 italic">"{dp.context_snippet}"</p>
                      )}
                      {dp.properties && (
                        <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                          <p>{dp.properties.pharmacology}</p>
                          <p>Legal: {dp.properties.legal_status}</p>
                          {dp.properties.pubchem_cid && <p>PubChem CID: {dp.properties.pubchem_cid}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Labels */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Label Assignment</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Auto label', val: story.label_assignment?.auto_label_text || labelDisplay(story.label_assignment?.auto_label) },
                    { label: 'Model label', val: labelDisplay(story.label_assignment?.model_label) },
                    { label: 'Rule label', val: labelDisplay(story.label_assignment?.rule_label) },
                    { label: 'LLM label', val: labelDisplay(story.label_assignment?.llm_label, story.label_assignment?.llm_status) },
                  ].map(({ label, val }) => (
                    <div key={label} className="border rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">{label}</p>
                      <p className="text-sm font-medium text-gray-800">{val}</p>
                    </div>
                  ))}
                </div>
                {story.label_assignment?.disagreement_flag && (
                  <p className="mt-2 text-xs bg-orange-50 border border-orange-200 text-orange-700 rounded px-3 py-2">
                    Labeler disagreement detected — human review recommended.
                  </p>
                )}
                {story.label_assignment?.active_learning_priority !== null && story.label_assignment?.active_learning_priority !== undefined && (
                  <p className="mt-1 text-xs text-gray-500">Active-learning priority: {story.label_assignment.active_learning_priority}</p>
                )}
              </div>

              {/* OAV triples */}
              {story.oav_triples?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    OAV Triples ({story.oav_triples.length})
                  </h3>
                  <div className="space-y-1">
                    {story.oav_triples.slice(0, 5).map((t, i) => (
                      <div key={i} className="text-xs bg-gray-50 border rounded px-3 py-2 font-mono text-gray-600">
                        {t.subject} — {t.predicate} — {t.object}
                      </div>
                    ))}
                    {story.oav_triples.length > 5 && (
                      <p className="text-xs text-gray-400">+{story.oav_triples.length - 5} more triples</p>
                    )}
                  </div>
                </div>
              )}

              {/* Ontology mappings */}
              {story.ontology_mappings?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Ontology Mappings ({story.ontology_mappings.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {story.ontology_mappings.map((m, i) => (
                      <span key={i} className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded">
                        {m.term}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Design C — Education & Support */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Education &amp; Support
                </h3>
                <EducationSection
                  edu={eduData?.education_session ?? null}
                  message={eduData?.sponsor_education_message || story.sponsor_explanation?.education_message || ''}
                />
              </div>

              {/* Validation */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Validation</h3>
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      story.validation?.status === 'validated'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {story.validation?.status?.replace(/_/g, ' ') || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {story.validation?.pending_review_count} pending review(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Completeness:</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-purple-500 h-1.5 rounded-full"
                        style={{ width: `${Math.round((story.validation?.completeness_score || 0) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {Math.round((story.validation?.completeness_score || 0) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {story && (
          <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between">
            <a
              href={story.video?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-600 hover:underline"
            >
              View on TikTok →
            </a>
            <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TikTokVideosPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-500">Loading...</div>}>
      <TikTokVideosContent />
    </Suspense>
  )
}

function TikTokVideosContent() {
  const searchParams = useSearchParams()
  const drugFromUrl = searchParams.get('drug') || ''

  const [videos, setVideos] = useState<TikTokVideo[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [drugs, setDrugs] = useState<string[]>([])

  const [selectedDrug, setSelectedDrug] = useState(drugFromUrl)
  const [days, setDays] = useState(365)

  const [drugSearch, setDrugSearch] = useState('')
  const [drugDropdownOpen, setDrugDropdownOpen] = useState(false)
  const drugDropdownRef = useRef<HTMLDivElement>(null)

  // Evidence drawer
  const [drawerVideoId, setDrawerVideoId] = useState<string | null>(null)
  const [sponsorVideoIds, setSponsorVideoIds] = useState<Set<string>>(new Set())

  const filteredDrugs = drugs.filter(drug =>
    drug.toLowerCase().includes(drugSearch.toLowerCase())
  )

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

  useEffect(() => { loadVideos() }, [page, selectedDrug, days])

  const loadFilters = async () => {
    try {
      const drugRes = await fetch('/api/v1/dashboard/filters/tiktok-drugs?limit=500')
      const drugData = await drugRes.json()
      setDrugs(drugData?.map((d: { scientific_name: string }) => d.scientific_name) || [])
    } catch (err) {
      console.error('Failed to load filters:', err)
    }
  }

  const loadSponsorIds = async () => {
    try {
      const res = await fetch('/api/v1/dashboard/tiktok/video-sponsor-story/reviewer-table?limit=2000')
      const data = await res.json()
      const ids = new Set<string>((data.rows || []).map((r: { video_id: string }) => r.video_id))
      setSponsorVideoIds(ids)
    } catch (err) {
      console.error('Failed to load sponsor IDs:', err)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadFilters(); loadSponsorIds() }, [])

  const loadVideos = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
        days: days.toString()
      })
      if (selectedDrug) params.append('drug', selectedDrug)
      const res = await fetch(`/api/v1/dashboard/posts/tiktok?${params}`)
      const data = await res.json()
      setVideos(data.posts)
      setTotal(data.total)
    } catch (err) {
      console.error('Failed to load videos:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })

  const formatNumber = (num: number) => {
    if (!num) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const extractHashtags = (description: string) => (description.match(/#\w+/g) || []).slice(0, 4)

  const videosWithDescriptions = (videos || []).filter(v => v.description && v.description.trim())
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      {drawerVideoId && (
        <EvidenceDrawer videoId={drawerVideoId} onClose={() => setDrawerVideoId(null)} />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">TikTok Videos</h1>
        <p className="text-gray-500">Browse and filter TikTok videos mentioning drugs</p>
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
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <div
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${!selectedDrug ? 'bg-pink-50 text-pink-700' : ''}`}
                    onClick={() => { setSelectedDrug(''); setPage(0); setDrugDropdownOpen(false); setDrugSearch('') }}
                  >
                    All drugs
                  </div>
                  {filteredDrugs.map(drug => (
                    <div
                      key={drug}
                      className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${selectedDrug === drug ? 'bg-pink-50 text-pink-700' : ''}`}
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

      <div className="mb-4 text-sm text-gray-500">
        Showing {videosWithDescriptions.length} of {formatNumber(total)} videos
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading videos...</div>
      ) : videosWithDescriptions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No videos found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videosWithDescriptions.map(video => {
            const hashtags = extractHashtags(video.description)
            return (
              <div key={video.video_id} className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  {video.scientific_name && (
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      {video.scientific_name}
                    </span>
                  )}
                  {video.substance_use_confidence && (
                    <span className="text-xs text-gray-500">
                      {Math.round(video.substance_use_confidence * 100)}% confidence
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-900 line-clamp-3 mb-3">{video.description}</p>

                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {hashtags.map((tag, i) => (
                      <span key={i} className="text-xs border border-gray-200 text-gray-600 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 12.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {formatNumber(video.comment_count)}
                  </span>
                  <span className="ml-auto">{formatDate(video.published_at)}</span>
                </div>

                <div className="flex gap-2">
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    TikTok
                  </a>
                  {/* Design A — Evidence Story button, only shown if sponsor data exists */}
                  {sponsorVideoIds.has(video.video_id) && (
                    <button
                      onClick={() => setDrawerVideoId(video.video_id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Evidence Story
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-gray-600">Page {page + 1} of {totalPages}</span>
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
