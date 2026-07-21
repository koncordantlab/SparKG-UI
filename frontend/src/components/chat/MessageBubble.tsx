'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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

function TypewriterText({ text, isLatest }: { text: string; isLatest: boolean }) {
  const [displayed, setDisplayed] = useState(isLatest ? '' : text)

  useEffect(() => {
    if (!isLatest) {
      setDisplayed(text)
      return
    }
    setDisplayed('')
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(interval)
    }, 12)
    return () => clearInterval(interval)
  }, [text, isLatest])

  return (
    <div className="text-sm leading-relaxed text-gray-800 prose prose-sm max-w-none
      prose-table:border-collapse prose-table:w-full
      prose-th:border prose-th:border-gray-300 prose-th:bg-gray-100 prose-th:px-3 prose-th:py-1 prose-th:text-left prose-th:text-xs prose-th:font-semibold
      prose-td:border prose-td:border-gray-200 prose-td:px-3 prose-td:py-1 prose-td:text-xs
      prose-strong:font-semibold prose-p:my-1 prose-ul:my-1 prose-li:my-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayed}</ReactMarkdown>
    </div>
  )
}

export default function MessageBubble({ message, onOptionSelect, isLatest }: Props) {
  const isBot = message.sender === 'bot'

  return (
    <div className={`flex ${isBot ? 'items-start' : 'items-start justify-end'} px-4 py-2`}>
      {isBot && (
        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 mr-3">
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
          {message.text && isBot ? (
            <TypewriterText text={message.text} isLatest={isLatest} />
          ) : message.text ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.text}
            </p>
          ) : null}

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

  const ec = content.exportContext
  switch (content.type) {
    case 'stats-cards':
      return <InlineStatsCards data={content.data as StatCard[]} title={content.title} exportContext={ec} />
    case 'bar-chart':
      return <InlineBarChart data={content.data as BarChartItem[]} title={content.title} exportContext={ec} />
    case 'line-chart':
      return <InlineLineChart data={content.data as LineChartPoint[]} title={content.title} exportContext={ec} />
    case 'posts-list':
      return <InlinePostsList data={content.data as PostItem[]} title={content.title} exportContext={ec} />
    default:
      return null
  }
}
