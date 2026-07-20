'use client'

import { useState, useEffect } from 'react'

interface ReviewRow {
  video_id: string
  url: string | null
  detected_drug: string | null
  matched_surface_term: string | null
  auto_label: number | null
  auto_label_text: string | null
  auto_label_confidence: number | null
  model_label: number | null
  rule_label: number | null
  llm_label: number | null
  llm_label_text: string | null
  llm_status: string
  llm_confidence: number | null
  drug_confidence: number | null
  active_learning_priority: number | null
  oav_triple_count: number
  ontology_mapping_count: number
  behavior_cv_summary: string | null
  education_top_action: string | null
  education_category: string | null
  education_score: number | null
  validation_status: string
  pending_review_count: number
  completeness_score: number
}

const AUTO_LABEL_COLORS: Record<number, string> = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-orange-100 text-orange-700',
  3: 'bg-red-100 text-red-700',
}

function pill(val: string | null | undefined, cls: string) {
  if (!val) return <span className="text-gray-400 text-xs">—</span>
  return <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{val}</span>
}

function numOrDash(val: number | null | undefined, decimals = 0) {
  if (val === null || val === undefined) return <span className="text-gray-400">—</span>
  return <span>{decimals > 0 ? val.toFixed(decimals) : val}</span>
}

function llmDisplay(row: ReviewRow) {
  if (row.llm_label !== null && row.llm_label !== undefined) {
    return <span className="text-xs font-medium text-gray-800">{row.llm_label} {row.llm_label_text ? `(${row.llm_label_text})` : ''}</span>
  }
  const status = row.llm_status || 'unknown'
  const cls = status === 'not_run_for_this_video'
    ? 'text-gray-400'
    : status.startsWith('preview')
    ? 'text-blue-500'
    : 'text-yellow-600'
  return <span className={`text-xs italic ${cls}`}>{status.replace(/_/g, ' ')}</span>
}

export default function SponsorReviewPage() {
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const limit = 50

  useEffect(() => {
    load()
  }, [page])

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch(
        `/api/v1/dashboard/tiktok/video-sponsor-story/reviewer-table?limit=${limit}&offset=${page * limit}`
      )
      const data = await res.json()
      setRows(data.rows || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.video_id.includes(q) ||
      (r.detected_drug || '').toLowerCase().includes(q) ||
      (r.matched_surface_term || '').toLowerCase().includes(q) ||
      (r.validation_status || '').toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sponsor Review Table</h1>
        <p className="text-gray-500">
          Batch review of all {total.toLocaleString()} videos, one row per video with full pipeline status.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white border rounded-xl shadow-sm p-4 mb-4 flex items-center gap-3">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Filter by video ID, drug, or status…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 text-sm outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">
            Clear
          </button>
        )}
        <span className="text-xs text-gray-400">{filtered.length} shown</span>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="sticky left-0 bg-gray-50 text-left text-xs font-semibold text-gray-500 px-3 py-2.5 whitespace-nowrap z-10 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                  Video ID
                </th>
                {['Drug / Term', 'Auto', 'Model', 'Rule', 'LLM', 'Conf.', 'Priority', 'OAV', 'Onto.', 'Behavior', 'Top Education Action', 'Edu Cat.', 'Edu Score', 'Validation', 'Pending', 'Complete'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-3 py-2.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={17} className="text-center py-10 text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={17} className="text-center py-10 text-gray-400">
                    No rows found.
                  </td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.video_id} className="group hover:bg-gray-50 transition-colors">
                    {/* Video ID / link — sticky left column */}
                    <td className="sticky left-0 bg-white group-hover:bg-gray-50 px-3 py-2.5 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap transition-colors">
                      {row.url ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-purple-600 hover:underline"
                        >
                          {row.video_id.slice(0, 14)}…
                        </a>
                      ) : (
                        <span className="text-xs font-mono text-gray-600">{row.video_id.slice(0, 14)}…</span>
                      )}
                    </td>

                    {/* Drug / term */}
                    <td className="px-3 py-2.5">
                      <div className="text-xs font-medium text-gray-800">{row.detected_drug || '—'}</div>
                      {row.matched_surface_term && (
                        <div className="text-xs text-gray-400">"{row.matched_surface_term}"</div>
                      )}
                      {row.drug_confidence !== null && row.drug_confidence !== undefined && (
                        <div className="text-xs text-gray-400">{Math.round(row.drug_confidence * 100)}%</div>
                      )}
                    </td>

                    {/* Auto label */}
                    <td className="px-3 py-2.5">
                      {row.auto_label !== null && row.auto_label !== undefined ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${AUTO_LABEL_COLORS[row.auto_label] || 'bg-gray-100 text-gray-600'}`}>
                          {row.auto_label}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Model label */}
                    <td className="px-3 py-2.5">{numOrDash(row.model_label)}</td>

                    {/* Rule label */}
                    <td className="px-3 py-2.5">{numOrDash(row.rule_label)}</td>

                    {/* LLM label + status */}
                    <td className="px-3 py-2.5 whitespace-nowrap">{llmDisplay(row)}</td>

                    {/* Confidence */}
                    <td className="px-3 py-2.5 text-xs text-gray-600">
                      {row.auto_label_confidence !== null && row.auto_label_confidence !== undefined
                        ? `${Math.round(row.auto_label_confidence * 100)}%`
                        : '—'}
                    </td>

                    {/* Active-learning priority */}
                    <td className="px-3 py-2.5">{numOrDash(row.active_learning_priority, 3)}</td>

                    {/* OAV triples */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-medium ${row.oav_triple_count > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {row.oav_triple_count}
                      </span>
                    </td>

                    {/* Ontology mappings */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-medium ${row.ontology_mapping_count > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                        {row.ontology_mapping_count}
                      </span>
                    </td>

                    {/* Behavior/CV */}
                    <td className="px-3 py-2.5 max-w-[120px]">
                      {row.behavior_cv_summary ? (
                        <span className="text-xs text-gray-600 line-clamp-2">{row.behavior_cv_summary}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Top education action */}
                    <td className="px-3 py-2.5 max-w-[160px]">
                      {row.education_top_action ? (
                        <span className="text-xs text-gray-700 line-clamp-2">{row.education_top_action}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Education category */}
                    <td className="px-3 py-2.5">
                      {row.education_category
                        ? pill(row.education_category.replace(/_/g, ' '), 'bg-green-100 text-green-700')
                        : <span className="text-gray-400 text-xs">—</span>}
                    </td>

                    {/* Education score */}
                    <td className="px-3 py-2.5">{numOrDash(row.education_score, 2)}</td>

                    {/* Validation status */}
                    <td className="px-3 py-2.5">
                      {pill(
                        row.validation_status?.replace(/_/g, ' '),
                        row.validation_status === 'validated'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      )}
                    </td>

                    {/* Pending review count */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-medium ${row.pending_review_count > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                        {row.pending_review_count}
                      </span>
                    </td>

                    {/* Completeness score */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-purple-500 h-1.5 rounded-full"
                            style={{ width: `${Math.round((row.completeness_score || 0) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{Math.round((row.completeness_score || 0) * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
          >
            Previous
          </button>
          <span className="text-gray-600 text-sm">
            Page {page + 1} of {totalPages} ({total.toLocaleString()} total videos)
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
