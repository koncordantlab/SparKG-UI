'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { BarChartItem } from '@/lib/chat/types'

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#06b6d4']

interface Props {
  data: BarChartItem[]
  title?: string
}

export default function InlineBarChart({ data, title }: Props) {
  if (!data || data.length === 0) return null

  return (
    <div className="mt-3">
      {title && <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{title}</p>}
      <div className="bg-gray-50 rounded-lg p-3 border">
        <ResponsiveContainer width="100%" height={Math.min(data.length * 36, 360)}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              width={120}
            />
            <Tooltip
              formatter={(value: number) => [value.toLocaleString(), 'Count']}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
