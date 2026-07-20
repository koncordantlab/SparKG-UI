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
  } else if (action.type === 'submit_text' && !node.showTextInput) {
    // Intent detection: free text from a menu node — try to route to data before LLM fallback
    const intent = detectVideoIntent(action.value, newState.context)
    if (intent) {
      newState = { ...newState, context: { ...newState.context, ...intent } }
      nextNodeId = 'drug-lookup.show-posts'
    } else {
      nextNodeId = 'free-text.llm-response'
    }
  } else if (action.type === 'submit_text' && node.showTextInput && node.id === 'free-text.input') {
    // Intent detection for the free-text input node too
    const intent = detectVideoIntent(action.value, newState.context)
    if (intent) {
      newState = { ...newState, context: { ...newState.context, ...intent } }
      nextNodeId = 'drug-lookup.show-posts'
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

const VIDEO_INTENT_KEYWORDS = [
  'video', 'videos', 'post', 'posts', 'show', 'get', 'find', 'list', 'fetch',
  'see', 'display', 'browse', 'content', 'clips', 'results',
]

const PLATFORM_KEYWORDS: Record<string, FlowContext['selectedPlatform']> = {
  tiktok: 'tiktok',
  'tik tok': 'tiktok',
  reddit: 'reddit',
  youtube: 'youtube',
  'you tube': 'youtube',
  yt: 'youtube',
}

function detectVideoIntent(
  query: string,
  ctx: FlowContext
): Partial<FlowContext> | null {
  const q = query.toLowerCase()

  const hasVideoIntent = VIDEO_INTENT_KEYWORDS.some(kw => q.includes(kw))
  if (!hasVideoIntent) return null

  // Detect platform from query or fall back to existing context
  let platform: FlowContext['selectedPlatform'] = ctx.selectedPlatform || 'tiktok'
  for (const [kw, p] of Object.entries(PLATFORM_KEYWORDS)) {
    if (q.includes(kw)) {
      platform = p
      break
    }
  }

  // Extract drug name: strip common filler words and pick the remaining content word(s)
  const STOP_WORDS = new Set([
    'get', 'me', 'the', 'show', 'find', 'list', 'fetch', 'see', 'display', 'browse',
    'give', 'containing', 'about', 'with', 'for', 'on', 'in', 'videos', 'video',
    'posts', 'post', 'clips', 'clip', 'content', 'results', 'related', 'to',
    'tiktok', 'reddit', 'youtube', 'all', 'platforms', 'a', 'an',
  ])

  const words = q
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))

  if (words.length === 0) return null

  // Use the longest remaining word as the likely drug name (keeps multi-syllable names over "use")
  const drugName = words.sort((a, b) => b.length - a.length)[0]
  if (drugName.length < 3) return null

  // Capitalize first letter to match stored drug names
  const selectedDrug = drugName.charAt(0).toUpperCase() + drugName.slice(1)

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
