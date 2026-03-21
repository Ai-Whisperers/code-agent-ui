import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { ThinkingStep } from '@/types/api'

const TOOL_LABELS: Record<string, string> = {
  knowledge_search: 'Searching knowledge base',
  search_knowledge_base: 'Searching knowledge base',
  semantic_search: 'Semantic search',
  customer_lookup: 'Looking up customer context',
  code_search: 'Searching source code',
  web_search: 'Searching the web',
}

export function ThinkingPanel({ steps, isLive }: { steps: ThinkingStep[]; isLive?: boolean }) {
  const [expanded, setExpanded] = useState(!!isLive)

  const toolCount = steps.filter((s) => s.kind === 'tool').length
  const summary = toolCount > 0
    ? `Used ${toolCount} tool${toolCount !== 1 ? 's' : ''}`
    : 'Thought through the answer'

  return (
    <div className="mb-3 pb-3 border-b border-[var(--color-cards-card-stroke)]">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1.5 text-xs text-[var(--color-fonts-font-color-support)] opacity-60 hover:opacity-100 transition-opacity w-full text-left"
      >
        <ChevronRight
          size={11}
          className={`shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        />
        {isLive ? (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Thinking…
          </span>
        ) : (
          <span>{summary}</span>
        )}
      </button>
      {expanded && steps.length > 0 && (
        <div className="mt-2 ml-3 border-l border-[var(--color-cards-card-stroke)] pl-3 flex flex-col gap-2">
          {steps.map((step, i) =>
            step.kind === 'thought' ? (
              <p
                key={i}
                className="text-xs italic text-[var(--color-fonts-font-color-support)] opacity-60 leading-relaxed"
              >
                {step.text}
              </p>
            ) : (
              <div
                key={i}
                className="inline-flex items-center gap-1.5 self-start px-2 py-0.5 rounded text-xs font-mono bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] border border-[var(--color-cards-card-stroke)]"
              >
                {TOOL_LABELS[step.name] ?? step.name.replace(/_/g, ' ')}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}
