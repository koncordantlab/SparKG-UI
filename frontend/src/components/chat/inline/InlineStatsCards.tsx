'use client'

import type { StatCard } from '@/lib/chat/types'

interface Props {
  data: StatCard[]
  title?: string
}

export default function InlineStatsCards({ data, title }: Props) {
  if (!data || data.length === 0) return null

  return (
    <div className="mt-3">
      {title && <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{title}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {data.map((card, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-3 border">
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className="text-lg font-bold text-gray-900">{card.value}</p>
            {card.subtitle && <p className="text-xs text-gray-400">{card.subtitle}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
