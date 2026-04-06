// Chat feature components - barrel export

export { PlanIndicator } from './PlanIndicator'
export { default as PlanDialog } from './PlanDialog'
export { ChatInputBar } from './ChatInputBar'
export type { ChatInputHandle } from './ChatInputBar'

export { MessageBubble } from './MessageBubble'
export { MarkdownMessage } from './MarkdownMessage'
export { StreamingMarkdownMessage } from './StreamingMarkdownMessage'
export { patchStreamingContent, DIAGRAM_LOADING_PLACEHOLDER } from './streamingUtils'
export { MermaidDiagram } from './MermaidDiagram'
export { ChartBlock } from './ChartBlock'
export { ThinkingPanel } from './ThinkingPanel'
export { SourcesSidebar } from './SourcesSidebar'
export { ClarificationBlock } from './ClarificationBlock'
export { extractWebSources, parseWebSearchResult, sourceDomain, faviconUrl } from './webSourceUtils'
export { ConversationSidebar } from './ConversationSidebar'

export { markdownComponents } from './markdownComponents'
export { detectSecrets, redactSecrets, SECRET_PATTERNS } from './SecretScanner'
export {
  saveMessagesToStorage,
  loadMessagesFromStorage,
  groupConversations,
  CONV_LS_KEY,
  type ConvGroup,
} from './conversationUtils'
