'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'

interface Drug {
  scientific_name: string
  common_terms: string
  category: string
  controlled_substance: boolean
  mention_count: number
}

interface DrugStats {
  scientific_name: string
  reddit_posts: number
  reddit_score: number
  reddit_comments: number
}

interface Category {
  category: string
  drug_count: number
}

const CATEGORY_COLORS: Record<string, string> = {
  opioid: 'bg-red-100 text-red-800',
  stimulant: 'bg-orange-100 text-orange-800',
  dissociative: 'bg-cyan-100 text-cyan-800',
  benzodiazepine: 'bg-blue-100 text-blue-800',
  cannabinoid: 'bg-green-100 text-green-800',
  psychedelic: 'bg-purple-100 text-purple-800',
  sedative: 'bg-indigo-100 text-indigo-800',
  anticonvulsant: 'bg-yellow-100 text-yellow-800',
  unknown: 'bg-gray-100 text-gray-800',
}

export default function RedditDrugsPage() {
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [allDrugNames, setAllDrugNames] = useState<Drug[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDrugFilter, setSelectedDrugFilter] = useState('')
  const [drugFilterSearch, setDrugFilterSearch] = useState('')
  const [drugFilterDropdownOpen, setDrugFilterDropdownOpen] = useState(false)
  const drugFilterDropdownRef = useRef<HTMLDivElement>(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)
  const [selectedDrug, setSelectedDrug] = useState<DrugStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState('mentions')
  const [sortOrder, setSortOrder] = useState('desc')
  const limit = 30

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!categories || !Array.isArray(categories)) return []
    if (!categorySearch) return categories
    const searchLower = categorySearch.toLowerCase()
    return categories.filter(cat => cat.category.toLowerCase().includes(searchLower))
  }, [categories, categorySearch])

  // Filter drugs for dropdown based on search
  const filteredDrugOptions = useMemo(() => {
    if (!allDrugNames || !Array.isArray(allDrugNames)) return []
    if (!drugFilterSearch) return allDrugNames
    const searchLower = drugFilterSearch.toLowerCase()
    return allDrugNames.filter(drug =>
      drug.scientific_name.toLowerCase().includes(searchLower) ||
      (drug.common_terms && drug.common_terms.toLowerCase().includes(searchLower))
    )
  }, [allDrugNames, drugFilterSearch])

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false)
      }
      if (drugFilterDropdownRef.current && !drugFilterDropdownRef.current.contains(event.target as Node)) {
        setDrugFilterDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    loadCategories()
    loadAllDrugNames()
  }, [])

  useEffect(() => {
    setPage(0) // Reset page when filters change
    loadDrugs()
  }, [selectedDrugFilter, selectedCategory, sortBy, sortOrder])

  useEffect(() => {
    loadDrugs()
  }, [page])

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/v1/dashboard/drugs/categories')
      const data = await res.json()
      setCategories(data)
    } catch (err) {
      console.error('Failed to load categories:', err)
    }
  }

  const loadAllDrugNames = async () => {
    try {
      const res = await fetch('/api/v1/dashboard/drugs?limit=500&sort_by=mentions&sort_order=desc')
      const data = await res.json()
      setAllDrugNames(data.drugs || [])
    } catch (err) {
      console.error('Failed to load drug names:', err)
    }
  }

  const loadDrugs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
        sort_by: sortBy,
        sort_order: sortOrder
      })
      if (selectedDrugFilter) params.append('search', selectedDrugFilter)
      if (selectedCategory) params.append('category', selectedCategory)

      const res = await fetch(`/api/v1/dashboard/drugs?${params}`)
      const data = await res.json()
      setDrugs(data.drugs)
      setTotal(data.total)
    } catch (err) {
      console.error('Failed to load drugs:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadDrugStats = async (drugName: string) => {
    try {
      setLoadingStats(true)
      const res = await fetch(`/api/v1/dashboard/drugs/${encodeURIComponent(drugName)}/stats`)
      const data = await res.json()
      setSelectedDrug(data)
    } catch (err) {
      console.error('Failed to load drug stats:', err)
    } finally {
      setLoadingStats(false)
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
        <h1 className="text-2xl font-bold text-gray-900">Reddit Drug List</h1>
        <p className="text-gray-500">Drugs monitored on Reddit with activity stats</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative" ref={drugFilterDropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Drug</label>
            <div
              className="w-full border rounded-lg px-3 py-2 cursor-pointer bg-white flex items-center justify-between"
              onClick={() => setDrugFilterDropdownOpen(!drugFilterDropdownOpen)}
            >
              <span className={selectedDrugFilter ? 'text-gray-900' : 'text-gray-500'}>
                {selectedDrugFilter || 'All drugs'}
              </span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {drugFilterDropdownOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-80 overflow-hidden">
                <div className="p-2 border-b">
                  <input
                    type="text"
                    placeholder="Search drugs..."
                    value={drugFilterSearch}
                    onChange={(e) => setDrugFilterSearch(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <div
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${!selectedDrugFilter ? 'bg-orange-50 text-orange-700' : ''}`}
                    onClick={() => { setSelectedDrugFilter(''); setPage(0); setDrugFilterDropdownOpen(false); setDrugFilterSearch('') }}
                  >
                    All drugs
                  </div>
                  {filteredDrugOptions.slice(0, 50).map(drug => (
                    <div
                      key={drug.scientific_name}
                      className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${selectedDrugFilter === drug.scientific_name ? 'bg-orange-50 text-orange-700' : ''}`}
                      onClick={() => { setSelectedDrugFilter(drug.scientific_name); setPage(0); setDrugFilterDropdownOpen(false); setDrugFilterSearch('') }}
                    >
                      {drug.scientific_name}
                    </div>
                  ))}
                  {filteredDrugOptions.length > 50 && (
                    <div className="px-3 py-2 text-gray-500 text-sm border-t">{filteredDrugOptions.length - 50} more results...</div>
                  )}
                  {filteredDrugOptions.length === 0 && (
                    <div className="px-3 py-2 text-gray-500 text-sm">No drugs found</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="relative" ref={categoryDropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <div
              className="w-full border rounded-lg px-3 py-2 cursor-pointer bg-white flex items-center justify-between"
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
            >
              <span className={selectedCategory ? 'text-gray-900' : 'text-gray-500'}>
                {selectedCategory || 'All categories'}
              </span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {categoryDropdownOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-80 overflow-hidden">
                <div className="p-2 border-b">
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <div
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${!selectedCategory ? 'bg-orange-50 text-orange-700' : ''}`}
                    onClick={() => { setSelectedCategory(''); setPage(0); setCategoryDropdownOpen(false); setCategorySearch('') }}
                  >
                    All categories
                  </div>
                  {filteredCategories.map(cat => (
                    <div
                      key={cat.category}
                      className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${selectedCategory === cat.category ? 'bg-orange-50 text-orange-700' : ''}`}
                      onClick={() => { setSelectedCategory(cat.category); setPage(0); setCategoryDropdownOpen(false); setCategorySearch('') }}
                    >
                      {cat.category} ({cat.drug_count})
                    </div>
                  ))}
                  {filteredCategories.length === 0 && (
                    <div className="px-3 py-2 text-gray-500 text-sm">No categories found</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="mentions">Mentions</option>
              <option value="name">Name</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="desc">High to Low</option>
              <option value="asc">Low to High</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Drug List */}
        <div className="flex-1">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading drugs...</div>
          ) : drugs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No drugs found matching your search</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drugs.map((drug) => (
                <div
                  key={drug.scientific_name}
                  onClick={() => loadDrugStats(drug.scientific_name)}
                  className={`bg-white rounded-xl shadow-sm p-4 cursor-pointer border hover:shadow-md transition-shadow ${
                    selectedDrug?.scientific_name === drug.scientific_name ? 'ring-2 ring-orange-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium text-gray-900">{drug.scientific_name}</h3>
                    <span className="text-sm text-gray-600">
                      <span className="font-medium">{formatNumber(drug.mention_count)}</span> mentions
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${CATEGORY_COLORS[drug.category] || CATEGORY_COLORS.unknown}`}>
                      {drug.category}
                    </span>
                  </div>

                  {drug.common_terms && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">Common Terms:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {drug.common_terms.split(';').slice(0, 3).map((term, i) => (
                          <span key={i} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                            {term.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
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

        {/* Drug Details Sidebar */}
        {selectedDrug && (
          <div className="w-80 bg-white rounded-xl shadow-sm p-6 h-fit sticky top-6 border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{selectedDrug.scientific_name}</h3>
              <button
                onClick={() => setSelectedDrug(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loadingStats ? (
              <div className="text-center py-4 text-gray-500">Loading stats...</div>
            ) : (
              <>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Reddit Activity</h4>
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Posts</span>
                      <span className="text-lg font-bold text-slate-700">
                        {formatNumber(selectedDrug.reddit_posts)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Score</span>
                      <span className="text-lg font-bold text-slate-700">
                        {formatNumber(selectedDrug.reddit_score)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Comments</span>
                      <span className="text-lg font-bold text-slate-700">
                        {formatNumber(selectedDrug.reddit_comments)}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/reddit/posts?drug=${encodeURIComponent(selectedDrug.scientific_name)}`}
                  className="block mt-4 text-center bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700"
                >
                  View Posts
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
