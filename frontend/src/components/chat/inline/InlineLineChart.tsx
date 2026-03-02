'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { LineChartPoint } from '@/lib/chat/types'

interface Props {
  data: LineChartPoint[]
  title?: string
}

export default function InlineLineChart({ data, title }: Props) {
  if (!data || data.length === 0) return null

  // Detect numeric keys besides 'date'
  const numericKeys = Object.keys(data[0] || {}).filter(
    (k) => k !== 'date' && typeof data[0][k] === 'number'
  )
  const lineKey = numericKeys[0] || 'mentions'

  // Format dates for display
  const formatted = data.map((p) => ({
    ...p,
    dateLabel: formatDateShort(p.date),
  }))

  return (
    <div className="mt-3">
      {title && <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{title}</p>}
      <div className="bg-gray-50 rounded-lg p-3 border">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={formatted} margin={{ left: 0, right: 10, top: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey={lineKey}
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
