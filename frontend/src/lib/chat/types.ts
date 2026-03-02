// === Message Types ===

export type MessageSender = 'bot' | 'user'

export type InlineComponentType =
  | 'stats-cards'
  | 'bar-chart'
  | 'line-chart'
  | 'posts-list'

export interface InlineContent {
  type: InlineComponentType
  data: unknown
  title?: string
}

export interface ChatMessage {
  id: string
  sender: MessageSender
  text: string
  timestamp: Date
  options?: QuickReplyOption[]
  inlineContent?: InlineContent
  isLoading?: boolean
  showTextInput?: boolean
}

export interface QuickReplyOption {
  label: string
  value: string
  variant?: 'primary' | 'secondary'
}

// === Flow Configuration Types ===

export interface FlowContext {
  selectedPlatform?: 'reddit' | 'tiktok' | 'youtube' | 'all'
  selectedDrug?: string
  selectedCategory?: string
  selectedTimePeriod?: string // '7' | '30' | '90' | '365'
  selectedBehaviorDimension?: string
  freeTextQuery?: string
  lastApiResult?: unknown
}

export interface FlowNode {
  id: string
  botMessage: string | ((ctx: FlowContext) => string)
  options?:
    | QuickReplyOption[]
    | ((ctx: FlowContext) => QuickReplyOption[])
    | ((ctx: FlowContext) => Promise<QuickReplyOption[]>)
  showTextInput?: boolean
  apiCall?: (ctx: FlowContext) => Promise<unknown>
  renderResult?: InlineComponentType
  resultTitle?: string | ((ctx: FlowContext) => string)
  next: Record<string, string> | ((value: string, ctx: FlowContext) => string)
}

export interface ChatState {
  messages: ChatMessage[]
  currentNodeId: string
  context: FlowContext
  isLoading: boolean
}

// === API Response Types for Inline Components ===

export interface StatCard {
  label: string
  value: number | string
  subtitle?: string
}

export interface BarChartItem {
  name: string
  value: number
}

export interface LineChartPoint {
  date: string
  [key: string]: string | number
}

export interface PostItem {
  id: string
  title: string
  platform: string
  drug?: string
  score?: number
  views?: number
  likes?: number
  comments?: number
  date: string
  url?: string
  confidence?: number
}
