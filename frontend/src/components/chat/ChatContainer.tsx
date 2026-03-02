'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ChatState } from '@/lib/chat/types'
import { createInitialState, processNodeEntry, processUserAction } from '@/lib/chat/chatEngine'
import MessageBubble from './MessageBubble'
import ChatTextInput from './ChatTextInput'
import ChatTypingIndicator from './ChatTypingIndicator'

export default function ChatContainer() {
  const [chatState, setChatState] = useState<ChatState>(createInitialState())
  const [initialized, setInitialized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize with the root greeting
  useEffect(() => {
    if (!initialized) {
      setInitialized(true)
      const init = async () => {
        const state = createInitialState()
        const newState = await processNodeEntry(state)
        setChatState(newState)
      }
      init()
    }
  }, [initialized])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatState.messages, chatState.isLoading])

  const handleOptionSelect = useCallback(async (value: string, label: string) => {
    setChatState((prev) => ({ ...prev, isLoading: true }))
    try {
      const newState = await processUserAction(chatState, {
        type: 'select_option',
        value,
        label,
      })
      setChatState(newState)
    } catch {
      setChatState((prev) => ({ ...prev, isLoading: false }))
    }
  }, [chatState])

  const handleTextSubmit = useCallback(async (text: string) => {
    setChatState((prev) => ({ ...prev, isLoading: true }))
    try {
      const newState = await processUserAction(chatState, {
        type: 'submit_text',
        value: text,
      })
      setChatState(newState)
    } catch {
      setChatState((prev) => ({ ...prev, isLoading: false }))
    }
  }, [chatState])

  const handleNewConversation = useCallback(async () => {
    const state = createInitialState()
    const newState = await processNodeEntry(state)
    setChatState(newState)
  }, [])

  const lastBotMessageIndex = chatState.messages.reduce(
    (last, msg, i) => (msg.sender === 'bot' ? i : last),
    -1
  )

  // Check if the latest bot message requests text input
  const latestBotMessage = lastBotMessageIndex >= 0 ? chatState.messages[lastBotMessageIndex] : null
  const showTextInput = latestBotMessage?.showTextInput || false

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">SPAR-KG Assistant</h1>
            <p className="text-xs text-gray-500">Drug trend analysis & insights</p>
          </div>
        </div>
        <button
          onClick={handleNewConversation}
          className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
        >
          New Conversation
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4">
        {chatState.messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onOptionSelect={handleOptionSelect}
            isLatest={i === lastBotMessageIndex}
          />
        ))}

        {chatState.isLoading && <ChatTypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Text input — always visible when flow requests it */}
      {showTextInput && (
        <ChatTextInput
          onSubmit={handleTextSubmit}
          placeholder="Type your question..."
          disabled={chatState.isLoading}
        />
      )}
    </div>
  )
}
