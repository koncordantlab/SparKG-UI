'use client'

import { useState, useEffect } from 'react'

interface Resource {
  id: string
  title: string
  description: string
  category: string
  type: string
  thumbnail: string | null
  download_url: string
}

const CATEGORY_COLORS: Record<string, string> = {
  Community: 'bg-green-100 text-green-700',
  School: 'bg-blue-100 text-blue-700',
  Handouts: 'bg-purple-100 text-purple-700',
}

function ResourceCard({ resource }: { resource: Resource }) {
  return (
    <a
      href={resource.download_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
    >
      {/* Thumbnail */}
      <div className="relative bg-gray-100 overflow-hidden" style={{ height: 200 }}>
        {resource.thumbnail ? (
          <img
            src={resource.thumbnail}
            alt={resource.title}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        )}
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-800 text-xs font-medium px-3 py-1.5 rounded-full shadow">
            Open PDF
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1">
        <div className="mb-2">
          <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${CATEGORY_COLORS[resource.category] || 'bg-gray-100 text-gray-600'}`}>
            {resource.category}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1 group-hover:text-purple-700 transition-colors">
          {resource.title}
        </h3>
        <p className="text-xs text-gray-500 line-clamp-2 flex-1">{resource.description}</p>
        <div className="mt-3 flex items-center gap-1 text-xs text-purple-600 font-medium">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </div>
      </div>
    </a>
  )
}

export default function EducationPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/v1/education/resources')
      const data = await res.json()
      setResources(data.resources || [])
      setCategories(['All', ...(data.categories || [])])
      setTotal(data.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = resources.filter(r => {
    const matchCat = activeCategory === 'All' || r.category === activeCategory
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="flex min-h-screen">
      {/* Left sidebar */}
      <aside className="w-56 flex-shrink-0 border-r bg-white p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Category</h2>
        <ul className="space-y-1">
          {categories.map(cat => (
            <li key={cat}>
              <button
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeCategory === cat
                    ? 'bg-purple-100 text-purple-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {cat}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main content */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Education & Prevention Resources</h1>
          <p className="text-gray-500 mt-1">
            SPAR-KG drug prevention materials: school curriculum and community outreach.
          </p>
        </div>

        {/* Search + count */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 flex items-center gap-2 bg-white border rounded-lg px-3 py-2 shadow-sm">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search resources…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 text-xs">Clear</button>
            )}
          </div>
          <span className="text-sm text-gray-500 whitespace-nowrap">
            {loading ? 'Loading…' : `${filtered.length} Results`}
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl animate-pulse" style={{ height: 280 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No resources found.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(r => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
