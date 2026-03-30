import { Store } from '@tanstack/react-store'
import type { ThinkingStep } from '@/types/api'

export interface ChatStreamState {
  /** Conversation ID being streamed. null for a new (unsaved) conversation. */
  conversationId: string | null
  isStreaming: boolean
  content: string
  thinkingSteps: ThinkingStep[]
}

export const chatStreamStore = new Store<ChatStreamState>({
  conversationId: null,
  isStreaming: false,
  content: '',
  thinkingSteps: [],
})

export const chatStreamActions = {
  start(conversationId: string | null): void {
    chatStreamStore.setState(() => ({
      conversationId,
      isStreaming: true,
      content: '',
      thinkingSteps: [],
    }))
  },
  setContent(content: string): void {
    chatStreamStore.setState((s) => ({ ...s, content }))
  },
  setThinkingSteps(thinkingSteps: ThinkingStep[]): void {
    chatStreamStore.setState((s) => ({ ...s, thinkingSteps }))
  },
  setConversationId(conversationId: string): void {
    chatStreamStore.setState((s) => ({ ...s, conversationId }))
  },
  finish(): void {
    chatStreamStore.setState((s) => ({
      ...s,
      isStreaming: false,
      content: '',
      thinkingSteps: [],
    }))
  },
}
