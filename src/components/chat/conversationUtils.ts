import type { ChatMessage, ConversationSummary } from '@/types/api'

export const CONV_LS_KEY = (id: string) => `conv_messages_${id}`

export function saveMessagesToStorage(id: string, msgs: ChatMessage[]) {
  try {
    localStorage.setItem(CONV_LS_KEY(id), JSON.stringify(msgs))
  } catch {
    // storage quota exceeded — silently ignore
  }
}

export function loadMessagesFromStorage(id: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CONV_LS_KEY(id))
    if (!raw) return []
    return JSON.parse(raw) as ChatMessage[]
  } catch {
    return []
  }
}

export type ConvGroup = { label: string; items: ConversationSummary[] }

export function groupConversations(convs: ConversationSummary[]): ConvGroup[] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000)
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 86_400_000)

  const groups: ConvGroup[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 days', items: [] },
    { label: 'Older', items: [] },
  ]

  for (const conv of convs) {
    const d = new Date(conv.updatedAt)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (dayStart >= todayStart) groups[0].items.push(conv)
    else if (dayStart >= yesterdayStart) groups[1].items.push(conv)
    else if (d >= sevenDaysAgo) groups[2].items.push(conv)
    else groups[3].items.push(conv)
  }

  return groups.filter((g) => g.items.length > 0)
}
