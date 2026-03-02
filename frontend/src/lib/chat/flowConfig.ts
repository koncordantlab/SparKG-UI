import type { FlowNode, FlowContext, QuickReplyOption, BarChartItem } from './types'
import {
  fetchTopDrugsForChat,
  fetchDrugStatsForChat,
  fetchPostsForChat,
  fetchDailyTrendForChat,
  fetchPlatformStatsForChat,
  fetchPlatformTopDrugs,
  fetchCategoryDistribution,
  fetchCategoriesForChat,
  fetchDrugsByCategory,
  fetchBehaviorBreakdown,
  fetchBehaviorVideos,
  askLLM,
} from './apiAdapters'

const TIME_OPTIONS: QuickReplyOption[] = [
  { label: 'Recent (1 week)', value: '7' },
  { label: '1 Month', value: '30' },
  { label: '3 Months', value: '90' },
  { label: '1 Year', value: '365' },
]

const PLATFORM_OPTIONS: QuickReplyOption[] = [
  { label: 'Reddit', value: 'reddit' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'All Platforms', value: 'all' },
]

function drugButtons(ctx: FlowContext): QuickReplyOption[] {
  const drugs = ctx.lastApiResult as { drugs: BarChartItem[] } | undefined
  const btns: QuickReplyOption[] = (drugs?.drugs || []).slice(0, 5).map((d) => ({
    label: d.name,
    value: `drug:${d.name}`,
  }))
  btns.push(
    { label: 'Change Time Period', value: 'change-time', variant: 'secondary' },
    { label: 'Start Over', value: 'start-over', variant: 'secondary' }
  )
  return btns
}

export const flowNodes: Record<string, FlowNode> = {
  // =========================================================================
  // ROOT
  // =========================================================================
  'root.start': {
    id: 'root.start',
    botMessage: 'Welcome to SPAR-KG Assistant! What would you like to explore?',
    options: [
      { label: 'Drug Trends', value: 'drug-trends' },
      { label: 'Drug Lookup', value: 'drug-lookup' },
      { label: 'Platform Overview', value: 'platform-overview' },
      { label: 'Behavioral Analysis', value: 'behavior' },
      { label: 'Ask a Question', value: 'free-text' },
    ],
    next: {
      'drug-trends': 'drug-trends.pick-platform',
      'drug-lookup': 'drug-lookup.search',
      'platform-overview': 'platform-overview.pick-platform',
      'behavior': 'behavior.pick-dimension',
      'free-text': 'free-text.input',
    },
  },

  // =========================================================================
  // FLOW 1: DRUG TRENDS
  // =========================================================================
  'drug-trends.pick-platform': {
    id: 'drug-trends.pick-platform',
    botMessage: 'Which platform do you want to explore drug trends for?',
    options: PLATFORM_OPTIONS,
    next: {
      reddit: 'drug-trends.pick-time',
      tiktok: 'drug-trends.pick-time',
      youtube: 'drug-trends.pick-time',
      all: 'drug-trends.pick-time',
    },
  },

  'drug-trends.pick-time': {
    id: 'drug-trends.pick-time',
    botMessage: (ctx) =>
      `How much data would you like to see for ${platformLabel(ctx.selectedPlatform)}?`,
    options: TIME_OPTIONS,
    next: {
      '7': 'drug-trends.show-top-drugs',
      '30': 'drug-trends.show-top-drugs',
      '90': 'drug-trends.show-top-drugs',
      '365': 'drug-trends.show-top-drugs',
    },
  },

  'drug-trends.show-top-drugs': {
    id: 'drug-trends.show-top-drugs',
    botMessage: (ctx) => {
      const result = ctx.lastApiResult as { dateRange?: string } | undefined
      const range = result?.dateRange
      return range
        ? `Here are the top mentioned drugs on ${platformLabel(ctx.selectedPlatform)} (${range}):`
        : `Here are the top mentioned drugs on ${platformLabel(ctx.selectedPlatform)}:`
    },
    apiCall: (ctx) =>
      fetchTopDrugsForChat(ctx.selectedPlatform || 'all', Number(ctx.selectedTimePeriod) || 30),
    renderResult: 'bar-chart',
    resultTitle: 'Top Drugs by Mentions',
    options: drugButtons,
    next: (value) => {
      if (value === 'change-time') return 'drug-trends.pick-time'
      if (value === 'start-over') return 'root.start'
      if (value.startsWith('drug:')) return 'drug-trends.drug-detail'
      return 'root.start'
    },
  },

  'drug-trends.drug-detail': {
    id: 'drug-trends.drug-detail',
    botMessage: (ctx) => `Here are the cross-platform stats for ${ctx.selectedDrug}:`,
    apiCall: (ctx) => fetchDrugStatsForChat(ctx.selectedDrug || ''),
    renderResult: 'stats-cards',
    options: [
      { label: 'View Reddit Posts', value: 'reddit-posts' },
      { label: 'View TikTok Videos', value: 'tiktok-posts' },
      { label: 'View YouTube Videos', value: 'youtube-posts' },
      { label: 'Analyze This', value: 'analyze' },
      { label: 'Back to Top Drugs', value: 'back', variant: 'secondary' },
      { label: 'Start Over', value: 'start-over', variant: 'secondary' },
    ],
    next: {
      'reddit-posts': 'drug-trends.show-posts',
      'tiktok-posts': 'drug-trends.show-posts',
      'youtube-posts': 'drug-trends.show-posts',
      'analyze': 'analyze.result',
      'back': 'drug-trends.show-top-drugs',
      'start-over': 'root.start',
    },
  },

  'drug-trends.show-posts': {
    id: 'drug-trends.show-posts',
    botMessage: (ctx) =>
      `Recent ${platformLabel(ctx.selectedPlatform)} content about ${ctx.selectedDrug}:`,
    apiCall: (ctx) =>
      fetchPostsForChat(
        ctx.selectedPlatform || 'reddit',
        ctx.selectedDrug || '',
        Number(ctx.selectedTimePeriod) || 30
      ),
    renderResult: 'posts-list',
    options: [
      { label: 'View Another Drug', value: 'another-drug', variant: 'secondary' },
      { label: 'Change Platform', value: 'change-platform', variant: 'secondary' },
      { label: 'Start Over', value: 'start-over', variant: 'secondary' },
    ],
    next: {
      'another-drug': 'drug-trends.show-top-drugs',
      'change-platform': 'drug-trends.pick-platform',
      'start-over': 'root.start',
    },
  },

  // =========================================================================
  // FLOW 2: DRUG LOOKUP
  // =========================================================================
  'drug-lookup.search': {
    id: 'drug-lookup.search',
    botMessage: 'Search for a drug by name, or pick a category to browse:',
    showTextInput: true,
    apiCall: () => fetchCategoriesForChat(),
    options: (ctx) => {
      const cats = ctx.lastApiResult as { categories: BarChartItem[] } | undefined
      const btns: QuickReplyOption[] = (cats?.categories || []).slice(0, 8).map((c) => ({
        label: c.name,
        value: `category:${c.name}`,
      }))
      btns.push({ label: 'Start Over', value: 'start-over', variant: 'secondary' })
      return btns
    },
    next: (value) => {
      if (value === 'start-over') return 'root.start'
      if (value.startsWith('category:')) return 'drug-lookup.browse-category'
      return 'drug-lookup.show-drug-stats'
    },
  },

  'drug-lookup.browse-category': {
    id: 'drug-lookup.browse-category',
    botMessage: (ctx) => `Drugs in the ${ctx.selectedCategory} category:`,
    apiCall: (ctx) => fetchDrugsByCategory(ctx.selectedCategory || '', 20),
    renderResult: 'bar-chart',
    resultTitle: (ctx) => `${ctx.selectedCategory} Drugs`,
    options: (ctx) => {
      const data = ctx.lastApiResult as { drugs: BarChartItem[] } | undefined
      const btns: QuickReplyOption[] = (data?.drugs || []).slice(0, 8).map((d) => ({
        label: d.name,
        value: `drug:${d.name}`,
      }))
      btns.push(
        { label: 'Back to Categories', value: 'back', variant: 'secondary' },
        { label: 'Start Over', value: 'start-over', variant: 'secondary' }
      )
      return btns
    },
    next: (value) => {
      if (value === 'back') return 'drug-lookup.search'
      if (value === 'start-over') return 'root.start'
      if (value.startsWith('drug:')) return 'drug-lookup.show-drug-stats'
      return 'drug-lookup.search'
    },
  },

  'drug-lookup.show-drug-stats': {
    id: 'drug-lookup.show-drug-stats',
    botMessage: (ctx) => `Cross-platform stats for ${ctx.selectedDrug}:`,
    apiCall: (ctx) => fetchDrugStatsForChat(ctx.selectedDrug || ''),
    renderResult: 'stats-cards',
    options: [
      { label: 'View Reddit Posts', value: 'reddit-posts' },
      { label: 'View TikTok Videos', value: 'tiktok-posts' },
      { label: 'View YouTube Videos', value: 'youtube-posts' },
      { label: 'View Trend Over Time', value: 'trend' },
      { label: 'Analyze This', value: 'analyze' },
      { label: 'Search Another Drug', value: 'search-another', variant: 'secondary' },
      { label: 'Start Over', value: 'start-over', variant: 'secondary' },
    ],
    next: (value) => {
      if (value === 'reddit-posts') return 'drug-lookup.show-posts'
      if (value === 'tiktok-posts') return 'drug-lookup.show-posts'
      if (value === 'youtube-posts') return 'drug-lookup.show-posts'
      if (value === 'trend') return 'drug-lookup.show-trend'
      if (value === 'analyze') return 'analyze.result'
      if (value === 'search-another') return 'drug-lookup.search'
      return 'root.start'
    },
  },

  'drug-lookup.show-posts': {
    id: 'drug-lookup.show-posts',
    botMessage: (ctx) =>
      `Recent ${platformLabel(ctx.selectedPlatform)} content about ${ctx.selectedDrug}:`,
    apiCall: (ctx) =>
      fetchPostsForChat(ctx.selectedPlatform || 'reddit', ctx.selectedDrug || '', 90),
    renderResult: 'posts-list',
    options: [
      { label: 'View on Another Platform', value: 'another-platform', variant: 'secondary' },
      { label: 'Back to Drug Stats', value: 'back', variant: 'secondary' },
      { label: 'Start Over', value: 'start-over', variant: 'secondary' },
    ],
    next: {
      'another-platform': 'drug-lookup.show-drug-stats',
      'back': 'drug-lookup.show-drug-stats',
      'start-over': 'root.start',
    },
  },

  'drug-lookup.show-trend': {
    id: 'drug-lookup.show-trend',
    botMessage: (ctx) => `Daily trend for ${ctx.selectedDrug} over the last 90 days:`,
    apiCall: (ctx) =>
      fetchDailyTrendForChat(ctx.selectedDrug || '', 90, 'all'),
    renderResult: 'line-chart',
    resultTitle: (ctx) => `${ctx.selectedDrug} - 90 Day Trend`,
    options: [
      { label: 'Analyze This', value: 'analyze' },
      { label: 'Back to Drug Stats', value: 'back', variant: 'secondary' },
      { label: 'Start Over', value: 'start-over', variant: 'secondary' },
    ],
    next: {
      'analyze': 'analyze.result',
      'back': 'drug-lookup.show-drug-stats',
      'start-over': 'root.start',
    },
  },

  // =========================================================================
  // FLOW 3: PLATFORM OVERVIEW
  // =========================================================================
  'platform-overview.pick-platform': {
    id: 'platform-overview.pick-platform',
    botMessage: 'Which platform would you like to explore?',
    options: [
      { label: 'Reddit', value: 'reddit' },
      { label: 'TikTok', value: 'tiktok' },
      { label: 'YouTube', value: 'youtube' },
    ],
    next: {
      reddit: 'platform-overview.show-stats',
      tiktok: 'platform-overview.show-stats',
      youtube: 'platform-overview.show-stats',
    },
  },

  'platform-overview.show-stats': {
    id: 'platform-overview.show-stats',
    botMessage: (ctx) => `Here's the overview for ${platformLabel(ctx.selectedPlatform)}:`,
    apiCall: (ctx) => fetchPlatformStatsForChat(ctx.selectedPlatform || 'reddit'),
    renderResult: 'stats-cards',
    options: [
      { label: 'Top Drugs', value: 'top-drugs' },
      { label: 'Category Breakdown', value: 'categories' },
      { label: 'Analyze This', value: 'analyze' },
      { label: 'Back', value: 'back', variant: 'secondary' },
      { label: 'Start Over', value: 'start-over', variant: 'secondary' },
    ],
    next: {
      'top-drugs': 'platform-overview.top-drugs',
      'categories': 'platform-overview.categories',
      'analyze': 'analyze.result',
      'back': 'platform-overview.pick-platform',
      'start-over': 'root.start',
    },
  },

  'platform-overview.top-drugs': {
    id: 'platform-overview.top-drugs',
    botMessage: (ctx) =>
      `Top mentioned drugs on ${platformLabel(ctx.selectedPlatform)}:`,
    apiCall: (ctx) => fetchPlatformTopDrugs(ctx.selectedPlatform || 'reddit'),
    renderResult: 'bar-chart',
    resultTitle: 'Top Drugs',
    options: (ctx) => {
      const data = ctx.lastApiResult as { drugs: BarChartItem[] } | undefined
      const btns: QuickReplyOption[] = (data?.drugs || []).slice(0, 5).map((d) => ({
        label: d.name,
        value: `drug:${d.name}`,
      }))
      btns.push(
        { label: 'Category Breakdown', value: 'categories', variant: 'secondary' },
        { label: 'Back', value: 'back', variant: 'secondary' },
        { label: 'Start Over', value: 'start-over', variant: 'secondary' }
      )
      return btns
    },
    next: (value) => {
      if (value === 'categories') return 'platform-overview.categories'
      if (value === 'back') return 'platform-overview.show-stats'
      if (value === 'start-over') return 'root.start'
      if (value.startsWith('drug:')) return 'drug-lookup.show-drug-stats'
      return 'root.start'
    },
  },

  'platform-overview.categories': {
    id: 'platform-overview.categories',
    botMessage: (ctx) =>
      `Drug category breakdown for ${platformLabel(ctx.selectedPlatform)}:`,
    apiCall: (ctx) => fetchCategoryDistribution(ctx.selectedPlatform || 'reddit'),
    renderResult: 'bar-chart',
    resultTitle: 'Category Distribution',
    options: (ctx) => {
      const data = ctx.lastApiResult as { categories: BarChartItem[] } | undefined
      const btns: QuickReplyOption[] = (data?.categories || []).slice(0, 5).map((c) => ({
        label: c.name,
        value: `category:${c.name}`,
      }))
      btns.push(
        { label: 'Top Drugs', value: 'top-drugs', variant: 'secondary' },
        { label: 'Back', value: 'back', variant: 'secondary' },
        { label: 'Start Over', value: 'start-over', variant: 'secondary' }
      )
      return btns
    },
    next: (value) => {
      if (value === 'top-drugs') return 'platform-overview.top-drugs'
      if (value === 'back') return 'platform-overview.show-stats'
      if (value === 'start-over') return 'root.start'
      if (value.startsWith('category:')) return 'drug-lookup.browse-category'
      return 'root.start'
    },
  },

  // =========================================================================
  // FLOW 4: BEHAVIORAL ANALYSIS
  // =========================================================================
  'behavior.pick-dimension': {
    id: 'behavior.pick-dimension',
    botMessage:
      'TikTok Behavioral Analysis — which dimension would you like to explore?',
    options: [
      { label: 'Behavioral Settings', value: 'settings' },
      { label: 'Psychological States', value: 'states' },
      { label: 'Reinforcement Patterns', value: 'reinforcement' },
      { label: 'Behavioral Outcomes', value: 'outcomes' },
      { label: 'Start Over', value: 'start-over', variant: 'secondary' },
    ],
    next: {
      settings: 'behavior.show-breakdown',
      states: 'behavior.show-breakdown',
      reinforcement: 'behavior.show-breakdown',
      outcomes: 'behavior.show-breakdown',
      'start-over': 'root.start',
    },
  },

  'behavior.show-breakdown': {
    id: 'behavior.show-breakdown',
    botMessage: (ctx) =>
      `Top ${dimensionLabel(ctx.selectedBehaviorDimension)} identified in substance-related TikTok videos:`,
    apiCall: (ctx) => fetchBehaviorBreakdown(ctx.selectedBehaviorDimension || 'settings'),
    renderResult: 'bar-chart',
    resultTitle: (ctx) => dimensionLabel(ctx.selectedBehaviorDimension),
    options: (ctx) => {
      const data = ctx.lastApiResult as { items: BarChartItem[] } | undefined
      const btns: QuickReplyOption[] = (data?.items || []).slice(0, 5).map((item) => ({
        label: item.name,
        value: `behavior-value:${item.name}`,
      }))
      btns.push(
        { label: 'Explore Another Dimension', value: 'another', variant: 'secondary' },
        { label: 'Start Over', value: 'start-over', variant: 'secondary' }
      )
      return btns
    },
    next: (value) => {
      if (value === 'another') return 'behavior.pick-dimension'
      if (value === 'start-over') return 'root.start'
      if (value.startsWith('behavior-value:')) return 'behavior.show-filtered-videos'
      return 'behavior.pick-dimension'
    },
  },

  'behavior.show-filtered-videos': {
    id: 'behavior.show-filtered-videos',
    botMessage: (ctx) => {
      const dim = ctx.selectedBehaviorDimension || 'settings'
      const val = ctx.freeTextQuery || ''
      return `TikTok videos matching ${dim} = "${val}":`
    },
    apiCall: (ctx) =>
      fetchBehaviorVideos(
        ctx.selectedBehaviorDimension || 'settings',
        ctx.freeTextQuery || '',
        10
      ),
    renderResult: 'posts-list',
    options: [
      { label: 'Explore Another Dimension', value: 'another', variant: 'secondary' },
      { label: 'Back to Breakdown', value: 'back', variant: 'secondary' },
      { label: 'Start Over', value: 'start-over', variant: 'secondary' },
    ],
    next: {
      another: 'behavior.pick-dimension',
      back: 'behavior.show-breakdown',
      'start-over': 'root.start',
    },
  },

  // =========================================================================
  // FLOW 5: FREE-TEXT (LLM)
  // =========================================================================
  'free-text.input': {
    id: 'free-text.input',
    botMessage:
      'Ask me anything about drug trends across platforms. I\'ll analyze the data for you.',
    showTextInput: true,
    options: [
      { label: 'Back to guided options', value: 'start-over', variant: 'secondary' },
    ],
    next: (value) => {
      if (value === 'start-over') return 'root.start'
      return 'free-text.llm-response'
    },
  },

  'free-text.llm-response': {
    id: 'free-text.llm-response',
    botMessage: '', // Will be replaced by LLM response
    apiCall: async (ctx) => {
      return askLLM(ctx.freeTextQuery || '', {
        platform: ctx.selectedPlatform,
        drug: ctx.selectedDrug,
        timePeriod: ctx.selectedTimePeriod,
      })
    },
    options: [
      { label: 'Ask Another Question', value: 'ask-another' },
      { label: 'Drug Trends', value: 'drug-trends' },
      { label: 'Drug Lookup', value: 'drug-lookup' },
      { label: 'Start Over', value: 'start-over', variant: 'secondary' },
    ],
    next: {
      'ask-another': 'free-text.input',
      'drug-trends': 'drug-trends.pick-platform',
      'drug-lookup': 'drug-lookup.search',
      'start-over': 'root.start',
    },
  },

  // =========================================================================
  // SHARED: ANALYZE (LLM)
  // =========================================================================
  'analyze.result': {
    id: 'analyze.result',
    botMessage: '', // Will be replaced by LLM analysis
    apiCall: async (ctx) => {
      const dataContext = ctx.lastApiResult || {}
      return askLLM(
        `Analyze the following data and provide key insights: ${JSON.stringify(dataContext)}`,
        {
          platform: ctx.selectedPlatform,
          drug: ctx.selectedDrug,
          timePeriod: ctx.selectedTimePeriod,
        }
      )
    },
    options: [
      { label: 'Ask a Follow-up', value: 'follow-up' },
      { label: 'Start Over', value: 'start-over', variant: 'secondary' },
    ],
    next: {
      'follow-up': 'free-text.input',
      'start-over': 'root.start',
    },
  },
}

// --- Helpers ---

function platformLabel(platform?: string): string {
  const labels: Record<string, string> = {
    reddit: 'Reddit',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    all: 'All Platforms',
  }
  return labels[platform || 'all'] || 'All Platforms'
}

function dimensionLabel(dim?: string): string {
  const labels: Record<string, string> = {
    settings: 'Behavioral Settings',
    states: 'Psychological States',
    reinforcement: 'Reinforcement Patterns',
    outcomes: 'Behavioral Outcomes',
  }
  return labels[dim || 'settings'] || dim || 'Settings'
}
