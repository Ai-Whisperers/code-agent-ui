import { useState, useEffect } from 'react'
import { ChevronRight, Loader2, CheckCircle2, XCircle, Wrench } from 'lucide-react'
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
  const thoughtSteps = steps.filter((s): s is ThinkingStep & { kind: 'thought' } => s.kind === 'thought')
  
  const hasTools = toolSteps.length > 0
  const hasThoughts = thoughtSteps.length > 0
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
        <div className="mt-2 ml-3 border-l border-[var(--color-cards-card-stroke)] pl-3 flex flex-col gap-3">
          {/* Thoughts section */}
          {hasThoughts && (
            <div className="flex flex-col gap-2">
              {thoughtSteps.map((step, i) => (
                <p
                  key={`thought-${i}`}
                  className="text-xs italic text-[var(--color-fonts-font-color-support)] opacity-60 leading-relaxed"
                >
                  {step.text}
                </p>
              ))}
            </div>
          )}
          
          {/* Tools section */}
          {hasTools && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-fonts-font-color-support)] opacity-70 mb-1">
                <Wrench size={11} />
                <span>Tools</span>
              </div>
              
              {toolSteps.map((tool, i) => {
                const isExpanded = expandedTools.has(i)
                const duration = tool.endTime && tool.startTime 
                  ? formatDuration(tool.endTime - tool.startTime)
                  : tool.startTime && isLive
                    ? formatDuration(now - tool.startTime)
                    : null
                
                const keyParam = getKeyParamDisplay(tool.name, tool.input)
                
                return (
                  <div key={`tool-${i}`} className="flex flex-col">
                    <button
                      onClick={() => tool.result && toggleTool(i)}
                      className={`flex items-center gap-2 text-left group ${tool.result ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                    >
                      {/* Status icon */}
                      {tool.status === 'running' && (
                        <Loader2 size={12} className="text-blue-500 animate-spin" />
                      )}
                      {tool.status === 'completed' && (
                        <CheckCircle2 size={12} className="text-green-500" />
                      )}
                      {tool.status === 'error' && (
                        <XCircle size={12} className="text-red-500" />
                      )}
                      
                      {/* Tool name, key param, duration, and toggle grouped together */}
                      <span className="text-xs text-[var(--color-fonts-font-color-support)] flex items-center gap-2">
                        <span>
                          {TOOL_LABELS[tool.name] ?? tool.name.replace(/_/g, ' ')}
                          {keyParam && (
                            <span className="opacity-70 ml-1">— {keyParam}</span>
                          )}
                        </span>
                        
                        {duration && (
                          <span className="opacity-50">
                            in {duration}
                          </span>
                        )}
                        
                        {tool.result && (
                          <ChevronRight
                            size={11}
                            className={`opacity-40 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        )}
                      </span>
                    </button>
                    
                    {/* Expanded result */}
                    {isExpanded && tool.result && (
                      <div className="mt-1.5 ml-5 p-2 rounded bg-[var(--color-tags-neutral-background)] border border-[var(--color-cards-card-stroke)] text-xs font-mono text-[var(--color-fonts-font-color-support)] opacity-80 max-h-32 overflow-y-auto">
                        <pre className="whitespace-pre-wrap break-all">{tool.result}</pre>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
