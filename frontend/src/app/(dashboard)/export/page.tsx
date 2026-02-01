'use client'

import { useState, useEffect, useMemo, useRef } from 'react'

type Platform = 'reddit' | 'tiktok' | 'youtube'

interface DateRange {
  min_date: string | null
  max_date: string | null
}


const monthNames: Record<string, string> = {
  '01': 'January', '02': 'February', '03': 'March', '04': 'April',
  '05': 'May', '06': 'June', '07': 'July', '08': 'August',
  '09': 'September', '10': 'October', '11': 'November', '12': 'December'
}

export default function ExportDataPage() {
  const [platform, setPlatform] = useState<Platform>('reddit')
  const [dateRange, setDateRange] = useState<DateRange>({ min_date: null, max_date: null })
  const [drugs, setDrugs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Filter states
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedDrug, setSelectedDrug] = useState('')
  const [drugSearch, setDrugSearch] = useState('')
  const [showDrugDropdown, setShowDrugDropdown] = useState(false)
  const drugInputRef = useRef<HTMLInputElement>(null)
  const drugDropdownRef = useRef<HTMLDivElement>(null)

  // Extract available years from date range
  const availableYears = useMemo(() => {
    if (!dateRange.min_date || !dateRange.max_date) return []
    const minYear = parseInt(dateRange.min_date.split('-')[0])
    const maxYear = parseInt(dateRange.max_date.split('-')[0])
    const years: string[] = []
    for (let y = maxYear; y >= minYear; y--) {
      years.push(y.toString())
    }
    return years
  }, [dateRange])

  // Extract available months for selected year from date range
  const availableMonths = useMemo(() => {
    if (!selectedYear || !dateRange.min_date || !dateRange.max_date) return []

    const minDate = dateRange.min_date
    const maxDate = dateRange.max_date
    const minYear = parseInt(minDate.split('-')[0])
    const maxYear = parseInt(maxDate.split('-')[0])
    const minMonth = parseInt(minDate.split('-')[1])
    const maxMonth = parseInt(maxDate.split('-')[1])
    const year = parseInt(selectedYear)

    const months: string[] = []

    // Determine start and end months based on selected year
    let startMonth = 1
    let endMonth = 12

    if (year === minYear) {
      startMonth = minMonth
    }
    if (year === maxYear) {
      endMonth = maxMonth
    }

    for (let m = startMonth; m <= endMonth; m++) {
      months.push(m.toString().padStart(2, '0'))
    }

    return months
  }, [selectedYear, dateRange])

  // Filter drugs based on search
  const filteredDrugs = useMemo(() => {
    if (!drugs || !Array.isArray(drugs)) return []
    if (!drugSearch) return drugs
    const searchLower = drugSearch.toLowerCase()
    return drugs.filter(drug => drug.toLowerCase().includes(searchLower))
  }, [drugs, drugSearch])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        drugDropdownRef.current &&
        !drugDropdownRef.current.contains(event.target as Node) &&
        drugInputRef.current &&
        !drugInputRef.current.contains(event.target as Node)
      ) {
        setShowDrugDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    loadPlatformData()
  }, [platform])

  const loadPlatformData = async () => {
    setLoading(true)
    setSelectedYear('')
    setSelectedMonth('')
    setSelectedDrug('')
    setDrugSearch('')
    setShowDrugDropdown(false)

    try {
      // Get date range
      const dateRes = await fetch(`/api/v1/dashboard/export/date-range/${platform}`)
      const dateData = await dateRes.json()
      setDateRange(dateData || { min_date: null, max_date: null })

      // Get drugs using the same endpoints as the platform drug list pages
      let drugsData: string[] = []
      if (platform === 'reddit') {
        // Reddit drugs page uses /api/v1/dashboard/drugs
        const res = await fetch('/api/v1/dashboard/drugs?limit=500&sort_by=mentions&sort_order=desc')
        const data = await res.json()
        drugsData = (data.drugs || []).map((d: { scientific_name: string }) => d.scientific_name)
      } else if (platform === 'tiktok') {
        // TikTok drugs page uses /api/v1/dashboard/tiktok/drugs
        const res = await fetch('/api/v1/dashboard/tiktok/drugs?limit=500&sort_by=mentions&sort_order=desc')
        const data = await res.json()
        drugsData = (data.drugs || []).map((d: { scientific_name: string }) => d.scientific_name)
      } else if (platform === 'youtube') {
        // YouTube drugs page uses /api/v1/dashboard/youtube/drugs
        const res = await fetch('/api/v1/dashboard/youtube/drugs?limit=500&sort_by=mentions&sort_order=desc')
        const data = await res.json()
        drugsData = (data.drugs || []).map((d: { scientific_name: string }) => d.scientific_name)
      }
      setDrugs(drugsData)
    } catch (err) {
      console.error('Failed to load platform data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)

    try {
      // Build date filters
      let startDate: string | undefined
      let endDate: string | undefined

      if (selectedYear) {
        if (selectedMonth) {
          startDate = `${selectedYear}-${selectedMonth}-01`
          // Get last day of month
          const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate()
          endDate = `${selectedYear}-${selectedMonth}-${lastDay.toString().padStart(2, '0')}`
        } else {
          startDate = `${selectedYear}-01-01`
          endDate = `${selectedYear}-12-31`
        }
      }

      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      if (selectedDrug) params.append('drug', selectedDrug)

      const res = await fetch(`/api/v1/dashboard/export/data/${platform}?${params}`)
      const data = await res.json()

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${platform}_export_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  const clearFilters = () => {
    setSelectedYear('')
    setSelectedMonth('')
    setSelectedDrug('')
    setDrugSearch('')
  }

  const handleDrugSelect = (drug: string) => {
    setSelectedDrug(drug)
    setDrugSearch(drug)
    setShowDrugDropdown(false)
  }

  const handleDrugInputChange = (value: string) => {
    setDrugSearch(value)
    setShowDrugDropdown(true)
    if (!value) {
      setSelectedDrug('')
    }
  }

  const hasFilters = selectedYear || selectedDrug

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Export Data</h1>
        <p className="text-gray-500">Download platform data in JSON format</p>
      </div>

      {/* Platform Selector */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border">
        <h3 className="font-semibold text-gray-900 mb-4">Select Platform</h3>
        <div className="flex gap-4">
          {(['reddit', 'tiktok', 'youtube'] as Platform[]).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                platform === p
                  ? 'bg-slate-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {dateRange.min_date && dateRange.max_date && (
          <p className="mt-4 text-sm text-gray-500">
            Data available from {dateRange.min_date} to {dateRange.max_date}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Filters (Optional)</h3>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading filters...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Year */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value)
                  if (!e.target.value) setSelectedMonth('')
                }}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">All Years</option>
                {(availableYears || []).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Month */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={!selectedYear}
                className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">All Months</option>
                {(availableMonths || []).map((month) => (
                  <option key={month} value={month}>{monthNames[month]}</option>
                ))}
              </select>
            </div>

            {/* Drug */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Drug</label>
              <div className="relative">
                <input
                  ref={drugInputRef}
                  type="text"
                  value={drugSearch}
                  onChange={(e) => handleDrugInputChange(e.target.value)}
                  onFocus={() => setShowDrugDropdown(true)}
                  placeholder="Search drugs..."
                  className="w-full border rounded-lg px-3 py-2 pr-8"
                />
                {drugSearch && (
                  <button
                    onClick={() => {
                      setDrugSearch('')
                      setSelectedDrug('')
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {showDrugDropdown && drugs.length > 0 && (
                <div
                  ref={drugDropdownRef}
                  className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto"
                >
                  {filteredDrugs.slice(0, 50).map((drug) => (
                    <button
                      key={drug}
                      onClick={() => handleDrugSelect(drug)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${
                        selectedDrug === drug ? 'bg-slate-100 font-medium' : ''
                      }`}
                    >
                      {drug}
                    </button>
                  ))}
                  {filteredDrugs.length > 50 && (
                    <div className="px-3 py-2 text-sm text-gray-500 border-t">
                      {filteredDrugs.length - 50} more results...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Export Preview & Button */}
      <div className="bg-white rounded-xl shadow-sm p-6 border">
        <h3 className="font-semibold text-gray-900 mb-4">Export Summary</h3>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Platform:</span>
              <span className="ml-2 font-medium text-gray-900 capitalize">{platform}</span>
            </div>
            <div>
              <span className="text-gray-500">Date Range:</span>
              <span className="ml-2 font-medium text-gray-900">
                {selectedYear ? (selectedMonth ? `${monthNames[selectedMonth]} ${selectedYear}` : selectedYear) : 'All dates'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Drug:</span>
              <span className="ml-2 font-medium text-gray-900">{selectedDrug || 'All'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="px-6 py-3 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {exporting ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export JSON
              </>
            )}
          </button>
          <span className="text-sm text-gray-500">
            Maximum 10,000 records per export
          </span>
        </div>
      </div>
    </div>
  )
}
