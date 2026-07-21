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
  title?: string
}

const API_BASE = '/api/v1'
const PLATFORMS = [
  { label: 'Reddit', value: 'reddit' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'YouTube', value: 'youtube' },
]

export default function ExportButton({ data, filename, exportContext, title }: Props) {
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

  const handlePdfExport = () => {
    const rows = Array.isArray(data) ? data : [data]
    const heading = title || filename
    const date = new Date().toLocaleDateString()

    const tableRows = rows.map((row) => {
      const entries = Object.entries(row as Record<string, unknown>)
      return `<tr>${entries.map(([k, v]) => `<td>${k}</td><td>${v ?? ''}</td>`).join('')}</tr>`
    }).join('')

    const html = `
      <html><head><title>${heading}</title>
      <style>
        body { font-family: sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p.meta { font-size: 11px; color: #666; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        td { border: 1px solid #ddd; padding: 6px 10px; vertical-align: top; }
        tr:nth-child(even) { background: #f9f9f9; }
        td:first-child { font-weight: 600; color: #555; width: 30%; }
      </style></head>
      <body>
        <h1>${heading}</h1>
        <p class="meta">Exported on ${date} · SPAR-KG Dashboard</p>
        <table>${tableRows}</table>
      </body></html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className="relative flex items-center gap-2">
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

      <button
        onClick={handlePdfExport}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
        title="Export data as PDF"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Export PDF
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
