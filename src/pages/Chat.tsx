import { useState, useRef, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  Bot,
  PanelLeftOpen,
  PanelLeftClose,
  X,
  ShieldAlert,
} from 'lucide-react'
import { refreshToken, getToken } from '@/lib/keycloak'
import type { ChatEvent, ChatMessage, ThinkingStep, ExecutionPlan, PlanStatus } from '@/types/api'
import {
  ChatInputBar,
  MessageBubble,
  ThinkingPanel,
  ConversationSidebar,
  MarkdownMessage,
  redactSecrets,
  loadMessagesFromStorage,
  saveMessagesToStorage,
  type ChatInputHandle,
  PlanDialog,
} from '@/components/chat'
import { PlanIndicator } from '@/components/chat/PlanIndicator'

export default function Chat() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useParams({ strict: false }) as { conversationId?: string }

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingThinkingSteps, setStreamingThinkingSteps] = useState<ThinkingStep[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    params.conversationId ?? null,
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [secretWarning, setSecretWarning] = useState<{
    findings: string[]
    pendingText: string
  } | null>(null)
  const [activePlans, setActivePlans] = useState<ExecutionPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<ExecutionPlan | null>(null)
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false)
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)
  const [generatingPlanTitle, setGeneratingPlanTitle] = useState<string>('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<ChatInputHandle>(null)
  const streamingContentRef = useRef('')
  const streamingRafRef = useRef<number | null>(null)

  // Load messages from localStorage when route param changes
  useEffect(() => {
    const id = params.conversationId
    if (id) {
      setActiveConversationId(id)
      setMessages(loadMessagesFromStorage(id))
    } else {
      setActiveConversationId(null)
      setMessages([])
    }
  }, [params.conversationId])

  // Scroll handling
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [isStreaming])

  // Scroll when new tool logs are added
  useEffect(() => {
    if (streamingThinkingSteps.length > 0 && isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [streamingThinkingSteps, isStreaming])

  const sendMessage = useCallback(
    async (text: string, attachmentIds?: string[], mode?: 'ask' | 'plan') => {
      if (!text.trim() || isStreaming) return

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
      }
      setMessages((prev) => [...prev, userMsg])
      setIsStreaming(true)
      setStreamingContent('')
      setStreamingThinkingSteps([])
      setMobileSidebarOpen(false)

      let accumulatedContent = ''
      const accumulatedThinkingSteps: ThinkingStep[] = []
      streamingContentRef.current = ''

      try {
        await refreshToken()
        const token = getToken()

        const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            message: text.trim(),
            ...(activeConversationId ? { conversationId: activeConversationId } : {}),
            ...(attachmentIds && attachmentIds.length > 0 ? { attachmentIds } : {}),
            ...(mode ? { mode } : {}),
          }),
        })

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const raw = line.slice(5).trim()
            if (!raw) continue

            let event: ChatEvent
            try {
              event = JSON.parse(raw)
              console.log('🔍 Parsed SSE event:', event.type, event)
            } catch (parseError) {
              console.error('❌ Failed to parse SSE event:', raw, parseError)
              continue
            }

            switch (event.type) {
              case 'thinking': {
                const last = accumulatedThinkingSteps[accumulatedThinkingSteps.length - 1]
                if (last?.kind === 'thought') {
                  last.text += event.text ?? ''
                } else {
                  accumulatedThinkingSteps.push({ kind: 'thought', text: event.text ?? '' })
                }
                setStreamingThinkingSteps([...accumulatedThinkingSteps])
                break
              }
              case 'text':
                accumulatedContent += event.text ?? ''
                streamingContentRef.current = accumulatedContent
                if (!streamingRafRef.current) {
                  streamingRafRef.current = requestAnimationFrame(() => {
                    setStreamingContent(streamingContentRef.current)
                    streamingRafRef.current = null
                  })
                }
                break
              case 'tool_start':
                accumulatedThinkingSteps.push({ 
                  kind: 'tool', 
                  name: event.tool ?? '', 
                  input: event.input,
                  status: 'running',
                  startTime: event.timestamp ?? Date.now()
                })
                setStreamingThinkingSteps([...accumulatedThinkingSteps])
                break
              case 'tool_end': {
                const lastTool = [...accumulatedThinkingSteps].reverse().find(s => s.kind === 'tool' && s.name === event.tool && s.status === 'running')
                if (lastTool && lastTool.kind === 'tool') {
                  lastTool.status = event.result?.startsWith('ERROR:') ? 'error' : 'completed'
                  lastTool.result = event.result
                  lastTool.endTime = event.timestamp ?? Date.now()
                }
                setStreamingThinkingSteps([...accumulatedThinkingSteps])
                break
              }
              case 'plan_start': {
                console.log('🎯 Received plan_start event:', event)
                // Set loading state to show spinner immediately with plan title
                setIsGeneratingPlan(true)
                setGeneratingPlanTitle(event.title || 'Generating plan...')
                break
              }
              case 'plan_created': {
                console.log('🎯 Received plan_created event:', event)
                if (event.planId && event.title && event.status) {
                  // Fetch full plan details from the API
                  const fetchPlan = async () => {
                    try {
                      const token = getToken()
                      const url = `${import.meta.env.VITE_API_URL}/plans/${event.planId}`
                      console.log('📡 Fetching plan details from:', url)
                      
                      const planResponse = await fetch(url, {
                        headers: { Authorization: `Bearer ${token}` }
                      })
                      
                      console.log('📥 Plan API response:', planResponse.status, planResponse.ok)
                      
                      if (planResponse.ok) {
                        const plan: ExecutionPlan = await planResponse.json()
                        console.log('✅ Plan fetched successfully:', plan)
                        
                        // Clear loading state now that plan is ready
                        setIsGeneratingPlan(false)
                        setGeneratingPlanTitle('')
                        
                        setActivePlans(prev => {
                          // Remove any existing plan with same ID and add the new one
                          const filtered = prev.filter(p => p.planId !== plan.planId)
                          console.log('🔄 Updating activePlans, new count:', filtered.length + 1)
                          return [...filtered, plan]
                        })
                      } else {
                        const errorText = await planResponse.text()
                        console.error('❌ Plan API failed:', planResponse.status, errorText)
                      }
                    } catch (error) {
                      console.error('❌ Failed to fetch plan details:', error)
                    }
                  }
                  fetchPlan()
                } else {
                  console.warn('⚠️ Invalid plan_created event data:', event)
                }
                break
              }
              case 'plan_updated': {
                if (event.planId && event.status) {
                  setActivePlans(prev => prev.map(plan => 
                    plan.planId === event.planId 
                      ? { ...plan, status: event.status as PlanStatus }
                      : plan
                  ))
                }
                break
              }
              case 'done': {
                const assistantMsg: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: accumulatedContent,
                  thinkingSteps: accumulatedThinkingSteps.length > 0 ? [...accumulatedThinkingSteps] : undefined,
                }
                setMessages((prev) => {
                  const next = [...prev, assistantMsg]
                  const convId = event.conversationId ?? activeConversationId
                  if (convId) saveMessagesToStorage(convId, next)
                  return next
                })
                if (streamingRafRef.current) {
                  cancelAnimationFrame(streamingRafRef.current)
                  streamingRafRef.current = null
                }
                setStreamingContent('')
                setStreamingThinkingSteps([])
                setIsStreaming(false)
                if (event.conversationId && event.conversationId !== activeConversationId) {
                  setActiveConversationId(event.conversationId)
                  navigate({ to: '/chat/$conversationId', params: { conversationId: event.conversationId } })
                }
                queryClient.invalidateQueries({ queryKey: ['conversations'] })
                return
              }
              case 'error':
                setMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: `**Error:** ${event.error ?? 'Something went wrong.'}`,
                  },
                ])
                if (streamingRafRef.current) {
                  cancelAnimationFrame(streamingRafRef.current)
                  streamingRafRef.current = null
                }
                setStreamingContent('')
                setStreamingThinkingSteps([])
                setIsStreaming(false)
                return
            }
          }
        }

        // Stream ended without 'done' event
        if (accumulatedContent) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: accumulatedContent,
              thinkingSteps: accumulatedThinkingSteps.length > 0 ? [...accumulatedThinkingSteps] : undefined,
            },
          ])
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '**Error:** Could not reach the assistant. Please try again.',
          },
        ])
      } finally {
        if (streamingRafRef.current) {
          cancelAnimationFrame(streamingRafRef.current)
          streamingRafRef.current = null
        }
        setIsStreaming(false)
        setStreamingContent('')
        setStreamingThinkingSteps([])
      }
    },
    [isStreaming, activeConversationId, navigate, queryClient],
  )

  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveConversationId(id)
      setMessages(loadMessagesFromStorage(id))
      setStreamingContent('')
      setMobileSidebarOpen(false)
      navigate({ to: '/chat/$conversationId', params: { conversationId: id } })
    },
    [navigate],
  )

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null)
    setMessages([])
    setStreamingContent('')
    chatInputRef.current?.clear()
    setMobileSidebarOpen(false)
    navigate({ to: '/chat' })
  }, [navigate])

  const handleSecretWarning = useCallback((findings: string[], pendingText: string) => {
    setSecretWarning({ findings, pendingText })
  }, [])

  const handleViewPlan = useCallback((plan: ExecutionPlan) => {
    navigate({ to: `/plans/${plan.planId}` })
  }, [navigate])

  const handleClickPlan = useCallback((plan: ExecutionPlan) => {
    setSelectedPlan(plan)
    setIsPlanDialogOpen(true)
  }, [])

  const handleClosePlanDialog = useCallback(() => {
    setIsPlanDialogOpen(false)
    setSelectedPlan(null)
  }, [])

  const handleSavePlan = useCallback(async (planId: string, content: string) => {
    try {
      const token = getToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL}/plans/${planId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markdownContent: content }),
      })

      if (!response.ok) {
        throw new Error('Failed to save plan')
      }

      // Update the plan in local state
      setActivePlans(prev => prev.map(plan => 
        plan.planId === planId 
          ? { ...plan, markdownContent: content }
          : plan
      ))

      if (selectedPlan && selectedPlan.planId === planId) {
        setSelectedPlan({ ...selectedPlan, markdownContent: content })
      }
    } catch (error) {
      console.error('Failed to save plan:', error)
      throw error
    }
  }, [selectedPlan])

  const handleImplementPlan = useCallback((planId: string) => {
    // Plan implementation is handled by the PlanIndicator component
    // We can optionally navigate to the plan page after implementation
    navigate({ to: `/plans/${planId}` })
  }, [navigate])

  const handleDismissPlan = useCallback((planId: string) => {
    setActivePlans(prev => prev.filter(p => p.planId !== planId))
  }, [])

  return (
    <div
      className="-mx-8 -my-6 flex bg-[var(--color-page-background)]"
      style={{ height: '100dvh' }}
    >
      {/* Mobile sidebar overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 sm:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

    {/* Conversation sidebar (desktop) */}
    <div
      className={`hidden sm:flex flex-col shrink-0 border-r border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)] transition-all duration-200 overflow-hidden ${
        sidebarOpen ? 'w-64' : 'w-0'
      }`}
      style={{ height: '100dvh' }}
    >
      <div className="shrink-0 flex items-center justify-between px-3 pt-4 pb-2">
        <span className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wider">
          Conversations
        </span>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1 rounded hover:bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-support)] transition-colors"
          title="Collapse sidebar"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <ConversationSidebar
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
        />
      </div>
    </div>

    {/* Conversation sidebar (mobile drawer) */}
    <div
      className={`fixed top-0 left-0 bottom-0 z-30 w-72 flex flex-col border-r border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)] sm:hidden transition-transform duration-200 ${
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="shrink-0 flex items-center justify-between px-3 pt-4 pb-2 border-b border-[var(--color-cards-card-stroke)]">
        <span className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wider">
          Conversations
        </span>
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="p-1 rounded hover:bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-support)] transition-colors"
        >
          <X size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <ConversationSidebar
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
        />
      </div>
    </div>

    {/* Conversation sidebar (mobile drawer) */}
    <div
      className={`fixed top-0 left-0 bottom-0 z-30 w-72 flex flex-col border-r border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)] sm:hidden transition-transform duration-200 ${
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="shrink-0 flex items-center justify-between px-3 pt-4 pb-2 border-b border-[var(--color-cards-card-stroke)]">
        <span className="text-xs font-semibold text-[var(--color-fonts-font-color-support)] uppercase tracking-wider">
          Conversations
        </span>
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="p-1 rounded hover:bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-support)] transition-colors"
        >
          <X size={15} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <ConversationSidebar
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
        />
      </div>
    </div>

    {/* Main chat panel */}
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-[var(--color-cards-card-stroke)]">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="sm:hidden p-1.5 rounded hover:bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-support)] transition-colors"
          title="Open conversations"
        >
          <PanelLeftOpen size={17} />
        </button>
        {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden sm:flex p-1.5 rounded hover:bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-support)] transition-colors"
              title="Open conversations"
            >
              <PanelLeftOpen size={17} />
            </button>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] truncate">
              AI Chat
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-buttons-button-primary)] flex items-center justify-center shadow-lg">
                <Bot size={28} className="text-white" />
              </div>
              <div>
                <p className="text-[var(--color-fonts-font-color-headings)] font-semibold text-base">
                  How can I help you today?
                </p>
                <p className="text-[var(--color-fonts-font-color-support)] text-sm mt-1 max-w-sm">
                  Ask about your codebase, architecture, team members, or anything else.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Active plan indicators */}
          {isGeneratingPlan && (
            <div className="mb-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                  <div>
                    <h3 className="font-medium text-blue-900 dark:text-blue-100">
                      Generating plan...
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {generatingPlanTitle || 'AI is creating an execution plan for your request'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activePlans.map((plan) => (
            <PlanIndicator
              key={plan.planId}
              plan={plan}
              onViewPlan={handleViewPlan}
              onImplementPlan={handleImplementPlan}
              onClick={handleClickPlan}
              onDismiss={() => handleDismissPlan(plan.planId)}
            />
          ))}

          {/* In-flight assistant message */}
          {isStreaming && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--color-buttons-button-primary)] flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={15} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] rounded-tl-sm px-4 py-3">
                  {streamingThinkingSteps.length > 0 && (
                    <ThinkingPanel steps={streamingThinkingSteps} isLive={true} />
                  )}
                  {streamingContent ? (
                    <MarkdownMessage content={streamingContent} />
                  ) : (
                    <div className="flex items-center gap-1.5 py-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[var(--color-fonts-font-color-support)] animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[var(--color-fonts-font-color-support)] animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[var(--color-fonts-font-color-support)] animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Secret warning banner */}
        {secretWarning && (
          <div className="shrink-0 mx-4 sm:mx-8 mb-2 rounded-[var(--border-radius-card)] border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
            <div className="flex items-start gap-3">
              <ShieldAlert
                size={18}
                className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Possible secrets detected
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {secretWarning.findings.map((f) => (
                    <span
                      key={f}
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300/60"
                    >
                      {f}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => {
                      sendMessage(redactSecrets(secretWarning.pendingText))
                      chatInputRef.current?.clear()
                      setSecretWarning(null)
                    }}
                    className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors"
                  >
                    Redact &amp; Send
                  </button>
                  <button
                    onClick={() => {
                      sendMessage(secretWarning.pendingText)
                      chatInputRef.current?.clear()
                      setSecretWarning(null)
                    }}
                    className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] border border-amber-400/60 bg-transparent hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-medium transition-colors"
                  >
                    Send Anyway
                  </button>
                  <button
                    onClick={() => {
                      setSecretWarning(null)
                      setTimeout(() => chatInputRef.current?.focus(), 0)
                    }}
                    className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] border border-[var(--color-cards-card-stroke)] bg-transparent hover:bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-support)] text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input bar */}
        <ChatInputBar
          ref={chatInputRef}
          isStreaming={isStreaming}
          conversationId={activeConversationId || undefined}
          onSend={sendMessage}
          onSecretWarning={handleSecretWarning}
        />
      </div>

      {/* Plan Dialog */}
      {selectedPlan && (
        <PlanDialog
          plan={selectedPlan}
          isOpen={isPlanDialogOpen}
          onClose={handleClosePlanDialog}
          onSave={handleSavePlan}
        />
      )}
    </div>
  )
}
