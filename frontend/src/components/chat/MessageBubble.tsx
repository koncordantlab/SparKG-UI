'use client'

import type { ChatMessage, StatCard, BarChartItem, LineChartPoint, PostItem } from '@/lib/chat/types'
import QuickReplyButtons from './QuickReplyButtons'
import InlineStatsCards from './inline/InlineStatsCards'
import InlineBarChart from './inline/InlineBarChart'
import InlineLineChart from './inline/InlineLineChart'
import InlinePostsList from './inline/InlinePostsList'

interface Props {
  message: ChatMessage
  onOptionSelect: (value: string, label: string) => void
  isLatest: boolean
}

export default function MessageBubble({ message, onOptionSelect, isLatest }: Props) {
  const isBot = message.sender === 'bot'

  return (
    <div className={`flex ${isBot ? 'items-start' : 'items-start justify-end'} px-4 py-2`}>
      {isBot && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0 mr-3">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
      )}

      <div className={`max-w-[85%] ${isBot ? '' : 'ml-auto'}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isBot
              ? 'bg-white shadow-sm border rounded-tl-sm'
              : 'bg-purple-100 text-purple-900 rounded-tr-sm'
          }`}
        >
          {message.text && (
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isBot ? 'text-gray-800' : ''}`}>
              {message.text}
            </p>
          )}

          {/* Inline content */}
          {message.inlineContent && renderInlineContent(message.inlineContent)}

          {/* Quick reply buttons */}
          {message.options && message.options.length > 0 && (
            <QuickReplyButtons
              options={message.options}
              onSelect={onOptionSelect}
              disabled={!isLatest}
            />
          )}
        </div>

        <p className={`text-[10px] text-gray-400 mt-1 ${isBot ? '' : 'text-right'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

function renderInlineContent(content: ChatMessage['inlineContent']) {
  if (!content) return null

  switch (content.type) {
    case 'stats-cards':
      return <InlineStatsCards data={content.data as StatCard[]} title={content.title} />
    case 'bar-chart':
      return <InlineBarChart data={content.data as BarChartItem[]} title={content.title} />
    case 'line-chart':
      return <InlineLineChart data={content.data as LineChartPoint[]} title={content.title} />
    case 'posts-list':
      return <InlinePostsList data={content.data as PostItem[]} title={content.title} />
    default:
      return null
  }
}
