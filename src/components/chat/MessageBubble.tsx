import { memo } from 'react'
import { User, Bot } from 'lucide-react'
import type { ChatMessage } from '@/types/api'
import { MarkdownMessage } from './MarkdownMessage'
import { ThinkingPanel } from './ThinkingPanel'

export const MessageBubble = memo(function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[80%] bg-[var(--color-buttons-button-primary)] text-white rounded-[var(--border-radius-card)] rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
        <div className="w-8 h-8 rounded-full bg-[var(--color-inputs-input-background)] border border-[var(--color-cards-card-stroke)] flex items-center justify-center shrink-0 mt-0.5">
          <User size={15} className="text-[var(--color-fonts-font-color-support)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-[var(--color-buttons-button-primary)] flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={15} className="text-white" />
      </div>
      <div className="flex-1 min-w-0 bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] rounded-tl-sm px-4 py-3">
        {message.thinkingSteps && message.thinkingSteps.length > 0 && (
          <ThinkingPanel steps={message.thinkingSteps} isLive={false} />
        )}
        <MarkdownMessage content={message.content} />
      </div>
    </div>
  )
})
