import type { ChatMessage, ChatState, FlowContext, FlowNode, QuickReplyOption } from './types'
import { flowNodes } from './flowConfig'

export function createInitialState(): ChatState {
  return {
    messages: [],
    currentNodeId: 'root.start',
    context: {},
    isLoading: false,
  }
}

export async function processNodeEntry(state: ChatState): Promise<ChatState> {
  const node = flowNodes[state.currentNodeId]
  if (!node) {
    return addBotMessage(state, 'Something went wrong. Let\'s start over.', [
      { label: 'Start Over', value: 'start-over', variant: 'secondary' },
    ])
  }

  const newState = { ...state, isLoading: true }

  // Execute API call if present
  let apiResult: unknown = undefined
  if (node.apiCall) {
    try {
      apiResult = await node.apiCall(newState.context)
      newState.context = { ...newState.context, lastApiResult: apiResult }
    } catch {
      return addBotMessage(
        { ...newState, isLoading: false },
        'Sorry, I couldn\'t fetch the data. Please try again.',
        [
          { label: 'Try Again', value: '__retry__' },
          { label: 'Start Over', value: 'start-over', variant: 'secondary' },
        ]
      )
    }
  }

  // Resolve bot message
  let text = typeof node.botMessage === 'function'
    ? node.botMessage(newState.context)
    : node.botMessage

  // For LLM nodes, the response comes from the API result
  if ((node.id === 'free-text.llm-response' || node.id === 'analyze.result') && apiResult) {
    const llmResult = apiResult as { answer: string }
    text = llmResult.answer || text || 'I couldn\'t generate a response.'
  }

  // Resolve options
  let options: QuickReplyOption[] | undefined
  if (node.options) {
    if (typeof node.options === 'function') {
      const result = node.options(newState.context)
      options = result instanceof Promise ? await result : result
    } else {
      options = node.options
    }
  }

  // Inject "Ask a Question" on every node that has options,
  // except the root menu and the free-text input itself
  if (
    options &&
    node.id !== 'free-text.input' &&
    node.id !== 'root.start' &&
    !options.some(o => o.value === 'ask-question')
  ) {
    options = [
      ...options,
      { label: 'Ask a Question', value: 'ask-question', variant: 'secondary' },
    ]
  }

  // Build inline content
  let inlineContent: ChatMessage['inlineContent'] = undefined
  if (node.renderResult && apiResult) {
    const resultTitle = node.resultTitle
      ? typeof node.resultTitle === 'function'
        ? node.resultTitle(newState.context)
        : node.resultTitle
      : undefined

    // Normalize data shape for each component type
    let data = apiResult
    if (node.renderResult === 'bar-chart') {
      const d = apiResult as Record<string, unknown>
      data = d.drugs || d.items || d.categories || []
    } else if (node.renderResult === 'stats-cards') {
      const d = apiResult as Record<string, unknown>
      data = d.stats || []
    } else if (node.renderResult === 'line-chart') {
      const d = apiResult as Record<string, unknown>
      data = d.points || []
    } else if (node.renderResult === 'posts-list') {
      const d = apiResult as Record<string, unknown>
      data = d.posts || []
    }

    inlineContent = {
      type: node.renderResult,
      data,
      title: resultTitle,
      exportContext: {
        drug: newState.context.selectedDrug,
        platform: newState.context.selectedPlatform,
      },
    }
  }

  const botMessage: ChatMessage = {
    id: crypto.randomUUID(),
    sender: 'bot',
    text,
    timestamp: new Date(),
    options,
    inlineContent,
    showTextInput: node.showTextInput,
  }

  return {
    ...newState,
    isLoading: false,
    messages: [...newState.messages, botMessage],
  }
}

export async function processUserAction(
  state: ChatState,
  action: { type: 'select_option' | 'submit_text'; value: string; label?: string }
): Promise<ChatState> {
  const node = flowNodes[state.currentNodeId]

  // Handle retry
  if (action.value === '__retry__') {
    return processNodeEntry(state)
  }

  // Handle persistent "Ask a Question" button
  if (action.value === 'ask-question') {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: 'Ask a Question',
      timestamp: new Date(),
    }
    return processNodeEntry({
      ...state,
      messages: [...state.messages, userMessage],
      currentNodeId: 'free-text.input',
    })
  }

  // Add user message — use the button label if available, otherwise the raw value
  const userLabel = action.label || action.value
  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    sender: 'user',
    text: userLabel,
    timestamp: new Date(),
  }

  let newState: ChatState = {
    ...state,
    messages: [...state.messages, userMessage],
  }

  // Update context based on value
  newState = updateContext(newState, action.value, node)

  // Resolve next node
  let nextNodeId: string
  if (!node) {
    nextNodeId = 'root.start'
  } else if (action.type === 'submit_text') {
    const platformTrend = detectPlatformTrendIntent(action.value)
    const drugStats = !platformTrend ? detectDrugStatsIntent(action.value) : null
    const postIntent = !platformTrend && !drugStats ? detectPostIntent(action.value, newState.context) : null
    if (platformTrend) {
      newState = { ...newState, context: { ...newState.context, selectedPlatform: platformTrend } }
      nextNodeId = 'drug-trends.pick-time'
    } else if (drugStats) {
      newState = { ...newState, context: { ...newState.context, selectedDrug: drugStats.selectedDrug, ...(drugStats.selectedPlatform ? { selectedPlatform: drugStats.selectedPlatform } : {}) } }
      nextNodeId = 'drug-lookup.show-drug-stats'
    } else if (postIntent) {
      if (Array.isArray(postIntent)) {
        let current = newState
        for (const intent of postIntent) {
          current = { ...current, context: { ...current.context, ...intent }, currentNodeId: 'drug-lookup.show-posts' }
          current = await processNodeEntry(current)
        }
        return current
      } else {
        newState = { ...newState, context: { ...newState.context, ...postIntent } }
        nextNodeId = 'drug-lookup.show-posts'
      }
    } else if (typeof node.next === 'function') {
      nextNodeId = node.next(action.value, newState.context)
    } else if (node.next[action.value]) {
      nextNodeId = node.next[action.value]
    } else {
      nextNodeId = 'free-text.llm-response'
    }
  } else if (typeof node.next === 'function') {
    nextNodeId = node.next(action.value, newState.context)
  } else {
    nextNodeId = node.next[action.value] || 'root.start'
  }

  newState = {
    ...newState,
    currentNodeId: nextNodeId,
  }

  // Process the next node
  return processNodeEntry(newState)
}

function updateContext(state: ChatState, value: string, node: FlowNode | undefined): ChatState {
  const ctx = { ...state.context }

  // Platform selection
  if (['reddit', 'tiktok', 'youtube', 'all'].includes(value)) {
    ctx.selectedPlatform = value as FlowContext['selectedPlatform']
  }

  // Time period
  if (['7', '30', '90', '365'].includes(value)) {
    ctx.selectedTimePeriod = value
  }

  // Drug selection
  if (value.startsWith('drug:')) {
    ctx.selectedDrug = value.replace('drug:', '')
  }

  // Category selection
  if (value.startsWith('category:')) {
    ctx.selectedCategory = value.replace('category:', '')
  }

  // Behavior dimension
  if (['settings', 'states', 'reinforcement', 'outcomes'].includes(value)) {
    ctx.selectedBehaviorDimension = value
  }

  // Behavior value filter
  if (value.startsWith('behavior-value:')) {
    ctx.freeTextQuery = value.replace('behavior-value:', '')
  }

  // Platform from post view buttons
  if (value === 'reddit-posts') ctx.selectedPlatform = 'reddit'
  if (value === 'tiktok-posts') ctx.selectedPlatform = 'tiktok'
  if (value === 'youtube-posts') ctx.selectedPlatform = 'youtube'

  // Free text input — capture query from any text submission
  if (
    !value.startsWith('drug:') &&
    !value.startsWith('category:') &&
    !['start-over', 'back'].includes(value) &&
    (node?.showTextInput || !Object.keys(node?.next || {}).includes(value))
  ) {
    ctx.freeTextQuery = value
    // If user is in drug-lookup search and typed a single word, treat as drug name
    if (node && node.id === 'drug-lookup.search' && value.trim().split(/\s+/).length === 1) {
      ctx.selectedDrug = value.trim()
    }
  }

  // Reset on start-over
  if (value === 'start-over') {
    return { ...state, context: {} }
  }

  return { ...state, context: ctx }
}


const TREND_KEYWORDS = ['trend', 'trends', 'trending', 'top drugs', 'popular']
const STATS_KEYWORDS = ['stat', 'stats', 'statistics', 'numbers', 'count', 'summary', 'overview', 'breakdown']
const PLATFORM_NAMES: Record<string, FlowContext['selectedPlatform']> = {
  reddit: 'reddit', tiktok: 'tiktok', 'tik tok': 'tiktok',
  youtube: 'youtube', 'you tube': 'youtube', yt: 'youtube',
}
const DRUG_STOP_WORDS = new Set([
  'get', 'me', 'the', 'show', 'find', 'stat', 'stats', 'statistics',
  'for', 'on', 'in', 'about', 'with', 'of', 'a', 'an', 'give',
  'tiktok', 'reddit', 'youtube', 'summary', 'overview', 'breakdown',
  'numbers', 'count', 'trend', 'trends', 'trending',
])

function detectPlatformTrendIntent(query: string): FlowContext['selectedPlatform'] | null {
  const q = query.toLowerCase().trim()
  // Only match "trends in X" style — not when a stats keyword is also present (that's drug stats)
  const hasTrend = TREND_KEYWORDS.some(kw => q.includes(kw))
  const hasStats = STATS_KEYWORDS.some(kw => q.includes(kw))
  if (!hasTrend || hasStats) return null
  for (const [kw, p] of Object.entries(PLATFORM_NAMES)) {
    if (q.includes(kw)) return p
  }
  return null
}

function detectDrugStatsIntent(query: string): { selectedDrug: string; selectedPlatform?: FlowContext['selectedPlatform'] } | null {
  const q = query.toLowerCase().trim()
  const hasStats = STATS_KEYWORDS.some(kw => q.includes(kw))
  if (!hasStats) return null

  let platform: FlowContext['selectedPlatform'] | undefined
  for (const [kw, p] of Object.entries(PLATFORM_NAMES)) {
    if (q.includes(kw)) { platform = p; break }
  }

  const words = q.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length >= 3 && !DRUG_STOP_WORDS.has(w))
  if (words.length === 0) return null

  const drugName = words.sort((a, b) => b.length - a.length)[0]
  const selectedDrug = drugName.charAt(0).toUpperCase() + drugName.slice(1)

  return { selectedDrug, selectedPlatform: platform }
}

const POST_FETCH_KEYWORDS = ['get', 'show', 'find', 'fetch', 'list', 'see', 'display', 'browse']
const POST_TARGET_KEYWORDS = ['post', 'posts', 'video', 'videos', 'content', 'clips']
const PLATFORM_MAP: Record<string, FlowContext['selectedPlatform']> = {
  tiktok: 'tiktok', 'tik tok': 'tiktok',
  reddit: 'reddit',
  youtube: 'youtube', 'you tube': 'youtube', yt: 'youtube',
}
const STOP_WORDS = new Set([
  'get', 'me', 'the', 'show', 'find', 'list', 'fetch', 'see', 'display', 'browse',
  'give', 'about', 'with', 'for', 'on', 'in', 'video', 'videos', 'post', 'posts',
  'clips', 'content', 'related', 'to', 'tiktok', 'reddit', 'youtube', 'a', 'an',
  'some', 'all', 'from', 'of',
])

function detectPostIntent(query: string, ctx: FlowContext): Partial<FlowContext> | Partial<FlowContext>[] | null {
  const q = query.toLowerCase().trim()

  const hasPostWord = POST_TARGET_KEYWORDS.some(kw => q.includes(kw))
  if (!hasPostWord) return null

  let platform: FlowContext['selectedPlatform'] = undefined
  for (const [kw, p] of Object.entries(PLATFORM_MAP)) {
    if (q.includes(kw)) { platform = p; break }
  }

  const words = q.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w))
  if (words.length === 0) return null

  const drugName = words.sort((a, b) => b.length - a.length)[0]
  const selectedDrug = drugName.charAt(0).toUpperCase() + drugName.slice(1)

  if (!platform) {
    return [
      { selectedPlatform: 'tiktok', selectedDrug },
      { selectedPlatform: 'reddit', selectedDrug },
      { selectedPlatform: 'youtube', selectedDrug }
    ]
  }

  return { selectedPlatform: platform, selectedDrug }
}

function addBotMessage(
  state: ChatState,
  text: string,
  options?: QuickReplyOption[]
): ChatState {
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    sender: 'bot',
    text,
    timestamp: new Date(),
    options,
  }
  return {
    ...state,
    isLoading: false,
    messages: [...state.messages, msg],
  }
}
