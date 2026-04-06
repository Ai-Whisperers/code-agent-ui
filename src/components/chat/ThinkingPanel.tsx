import { useState, useEffect } from 'react'
import { ChevronRight, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import type { ThinkingStep } from '@/types/api'

const TOOL_LABELS: Record<string, string> = {
  knowledge_search: 'Searching knowledge base',
  search_knowledge_base: 'Searching knowledge base',
  semantic_search: 'Semantic search',
  customer_lookup: 'Looking up customer context',
  code_search: 'Searching source code',
  web_search: 'Searching the web',
  jira_get_worklogs: 'Fetching worklogs',
  jira_search: 'Searching Jira issues',
  confluence_update_page: 'Updating Confluence page',
  confluence_search: 'Searching Confluence',
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.round((ms % 60000) / 1000)
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

function getKeyParamDisplay(toolName: string, input: Record<string, unknown> | undefined): string | null {
  if (!input) return null
  
  // Jira tools - show issue key
  if (toolName.includes('jira') && input.key) return input.key as string
  if (toolName.includes('jira') && input.issueKey) return input.issueKey as string
  
  // Search tools - show query
  if (toolName.includes('search') && input.query) return `"${input.query}"`
  if (toolName.includes('search') && input.q) return `"${input.q}"`
  
  // Customer lookup
  if (toolName === 'customer_lookup' && input.customerId) return input.customerId as string
  
  return null
}

export function ThinkingPanel({ steps, isLive }: { steps: ThinkingStep[]; isLive?: boolean }) {
  const [expanded, setExpanded] = useState(!!isLive)
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set())
  const [now, setNow] = useState(() => Date.now())

  // Update current time every second for live duration display
  useEffect(() => {
    if (!isLive) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [isLive])

  const toolSteps = steps.filter((s): s is ThinkingStep & { kind: 'tool' } => s.kind === 'tool')
  
  const hasTools = toolSteps.length > 0
  const runningCount = toolSteps.filter(t => t.status === 'running').length
  const completedCount = toolSteps.filter(t => t.status === 'completed').length
  const errorCount = toolSteps.filter(t => t.status === 'error').length

  const toggleTool = (idx: number) => {
    setExpandedTools(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const getSummary = () => {
    if (!hasTools) return 'Thought through the answer'
    if (runningCount > 0) return `Running ${runningCount} tool${runningCount !== 1 ? 's' : ''}…`
    if (errorCount > 0) return `${completedCount} completed, ${errorCount} failed`
    return `${completedCount} tool${completedCount !== 1 ? 's' : ''} completed`
  }

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
            {getSummary()}
          </span>
        ) : (
          <span>{getSummary()}</span>
        )}
      </button>
      
      {expanded && steps.length > 0 && (
        <div className="mt-2 ml-3 border-l border-[var(--color-cards-card-stroke)] pl-3 flex flex-col gap-2">
          {steps.map((step, i) => {
            if (step.kind === 'thought') {
              const thoughtText = step.text
                .replace(/<\/?thinking>/gi, '')
                .trim()
              if (!thoughtText) return null
              return (
                <p
                  key={`step-${i}`}
                  className="text-[11px] font-mono leading-relaxed text-[var(--color-fonts-font-color-support)] opacity-35 border-l border-[var(--color-cards-card-stroke)] pl-2"
                >
                  {thoughtText}
                </p>
              )
            } else {
              // This is a tool step - need to find its index in toolSteps array for expansion state
              const toolIndex = toolSteps.findIndex(tool => tool === step)
              const isExpanded = expandedTools.has(toolIndex)
              const duration = step.endTime && step.startTime 
                ? formatDuration(step.endTime - step.startTime)
                : step.startTime && isLive
                  ? formatDuration(now - step.startTime)
                  : null
              
              const keyParam = getKeyParamDisplay(step.name, step.input)
              
              return (
                <div key={`step-${i}`} className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => step.result && toggleTool(toolIndex)}
                      className={`flex items-center gap-2 text-left group ${step.result ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                    >
                      {/* Status icon */}
                      {step.status === 'running' && (
                        <Loader2 size={12} className="text-blue-500 animate-spin" />
                      )}
                      {step.status === 'completed' && (
                        <CheckCircle2 size={12} className="text-green-500" />
                      )}
                      {step.status === 'error' && (
                        <XCircle size={12} className="text-red-500" />
                      )}
                      
                      {/* Tool name, key param, duration, and toggle grouped together */}
                      <span className="text-xs text-[var(--color-fonts-font-color-support)] flex items-center gap-2">
                        <span>
                          {TOOL_LABELS[step.name] ?? step.name.replace(/_/g, ' ')}
                          {keyParam && (
                            <span className="opacity-70 ml-1">— {keyParam}</span>
                          )}
                        </span>
                        
                        {duration && (
                          <span className="opacity-50">
                            in {duration}
                          </span>
                        )}
                        
                        {step.result && (
                          <ChevronRight
                            size={11}
                            className={`opacity-40 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        )}
                      </span>
                    </button>
                  </div>
                  
                  {/* Expanded result */}
                  {isExpanded && step.result && (
                    <div className="mt-1.5 ml-5 p-2 rounded bg-[var(--color-tags-neutral-background)] border border-[var(--color-cards-card-stroke)] text-xs font-mono text-[var(--color-fonts-font-color-support)] opacity-80 max-h-32 overflow-y-auto">
                      <pre className="whitespace-pre-wrap break-all">{step.result}</pre>
                    </div>
                  )}
                </div>
              )
            }
          })}
        </div>
      )}
    </div>
  )
}
