'use client'

import type { QuickReplyOption } from '@/lib/chat/types'

interface Props {
  options: QuickReplyOption[]
  onSelect: (value: string, label: string) => void
  disabled: boolean
}

export default function QuickReplyButtons({ options, onSelect, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {options.map((opt) => {
        const isPrimary = opt.variant !== 'secondary'
        return (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value, opt.label)}
            disabled={disabled}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              disabled
                ? 'opacity-40 cursor-not-allowed'
                : isPrimary
                  ? 'bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
