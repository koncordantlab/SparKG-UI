'use client'

import { useState } from 'react'

export interface ExportContext {
  drug?: string
  platform?: string
}

interface Props {
  data: unknown
  filename: string
  exportContext?: ExportContext
}

const API_BASE = '/api/v1'
const PLATFORMS = [
  { label: 'Reddit', value: 'reddit' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'YouTube', value: 'youtube' },
]

export default function ExportButton({ data, filename, exportContext }: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSimpleExport = () => {
    const json = JSON.stringify(data, null, 2)
    downloadJson(json, filename)
  }

  const handlePlatformExport = async (platform: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '10000' })
      if (exportContext?.drug) {
        params.set('drug', exportContext.drug)
      }
      const res = await fetch(`${API_BASE}/dashboard/export/data/${platform}?${params}`)
      const result = await res.json()
      const json = JSON.stringify(result, null, 2)
      downloadJson(json, `${platform}_${exportContext?.drug || 'all'}_export`)
    } catch {
      // Fallback to inline data export
      handleSimpleExport()
    } finally {
      setLoading(false)
      setShowPicker(false)
    }
  }

  const handleClick = () => {
    if (exportContext?.drug) {
      setShowPicker(!showPicker)
    } else {
      handleSimpleExport()
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors disabled:opacity-50"
        title="Export data as JSON"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {loading ? 'Exporting...' : 'Export JSON'}
      </button>

      {showPicker && (
        <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
          <p className="px-3 py-1 text-[10px] text-gray-400 uppercase font-semibold">Select Platform</p>
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePlatformExport(p.value)}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-colors"
            >
              {p.label}
            </button>
          ))}
          <div className="border-t my-1" />
          <p className="px-3 py-0.5 text-[10px] text-gray-400">Max 10,000 records</p>
        </div>
      )}
    </div>
  )
}

function downloadJson(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
