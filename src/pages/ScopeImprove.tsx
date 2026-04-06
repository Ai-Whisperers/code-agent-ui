import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useSmoothScrollToBottom } from '@/hooks/useSmoothScrollToBottom'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Paperclip,
  Sparkles,
  AlertTriangle,
  Plus,
  Wand2,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  Download,
  Trash2,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { getToken, refreshToken } from '@/lib/keycloak'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Tooltip } from '@/components/ui/Tooltip'
import { Select } from '@/components/ui/Select'
import { Toast, type ToastConfig } from '@/components/ui/Toast'
import { TabBar, TabButton } from '@/components/ui/Tabs'
import { ResizableDivider } from '@/components/ui/ResizableDivider'
import { IssueTypeIcon } from '@/components/ui/IssueTypeIcon'
import { JiraIssueLink } from '@/components/ui/JiraIssueLink'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import {
  ChatInputBar,
  MessageBubble,
  StreamingMarkdownMessage,
  ThinkingPanel,
  extractWebSources,
  type ChatInputHandle,
} from '@/components/chat'
import type {
  ScopeProposal,
  ScopeProposalInitResult,
  JiraAttachment,
  JiraIssueReview,
  ConversationContext,
  ScopeTreeItem,
} from '@/types/api'
import type { ChatMessage, ThinkingStep } from '@/types/api'
import { mcpProfilesApi, type SystemConfig } from '@/lib/mcpProfiles'

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_OPTIONS = [
  { value: '', label: '— select —' },
  { value: 'Critical', label: 'Critical' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
]

/** Colour for the numeric readiness score based on the label band. */
const SCORE_COLOR: Record<string, string> = {
  poor:                          'text-[var(--color-tags-font-critical)]',
  needs_refinement:              'text-[var(--color-tags-font-attention)]',
  ready_with_minor_improvements: 'text-blue-600 dark:text-blue-400',
  fully_ready:                   'text-[var(--color-tags-font-success)]',
}

type SuggestedPrompt = { label: string; prompt: string }

/** Per-issue-type quick-start prompts shown in the empty chat state. */
const SUGGESTED_PROMPTS: Record<string, SuggestedPrompt[]> = {
  EPIC: [
    { label: 'Review the why',            prompt: 'Review the business case and suggest how to make the "why" clearer and more compelling.' },
    { label: 'Strengthen the summary',    prompt: 'Rewrite the summary to be more outcome-focused (start with a verb, ≤ 120 characters).' },
    { label: 'Add acceptance criteria',   prompt: 'Propose clear, measurable acceptance criteria for this Epic.' },
    { label: 'Identify missing features', prompt: 'Are there any obvious features missing to achieve the Epic goal?' },
  ],
  FEATURE: [
    { label: 'Review what to build',      prompt: 'Review the feature description and clarify what exactly needs to be built.' },
    { label: 'Improve description',       prompt: 'Improve the description so it is clear enough for the engineering team to start work.' },
    { label: 'Add technical notes',       prompt: 'Suggest relevant technical notes or implementation hints for this feature.' },
    { label: 'Propose acceptance criteria', prompt: 'Propose acceptance criteria covering happy path, edge cases, and error handling.' },
  ],
  USERSTORY: [
    { label: 'Review the how',            prompt: 'Review the user story and make the "how" concrete and actionable.' },
    { label: 'Check acceptance criteria', prompt: 'Review the acceptance criteria — are they complete, testable, and unambiguous?' },
    { label: 'Add edge cases',            prompt: 'Add edge cases and error scenarios to the acceptance criteria.' },
    { label: 'Improve the summary',       prompt: 'Rewrite the summary in the "As a … I want … so that …" format.' },
  ],
}

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1)  return 'yesterday'
  if (diffD < 7)    return `${diffD}d ago`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: diffD > 365 ? 'numeric' : undefined })
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TabState = {
  issueKey: string
  issueType: 'EPIC' | 'FEATURE' | 'USERSTORY'
  proposal: ScopeProposal | null
  attachments: JiraAttachment[]
  /** ISO timestamp of when the underlying Jira issue was last modified. */
  jiraUpdatedAt: string | null
  loading: boolean
  error: string | null
  dirty: boolean
  highlightedFields: Set<string>
  /** True for manually-created proposals that don't yet have a real Jira issue. */
  isNew?: boolean
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ScopeImproveProps {
  scopeId: string
  issueKey: string
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ScopeImprove({ scopeId, issueKey }: ScopeImproveProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<ToastConfig | null>(null)

  // ── Resizable split ────────────────────────────────────────────────────────
  const splitContainerRef = useRef<HTMLDivElement>(null)
  const [leftPct, setLeftPct] = useState(58)

  const handleSplitDrag = useCallback((clientX: number) => {
    const container = splitContainerRef.current
    if (!container) return
    const { left, width } = container.getBoundingClientRect()
    const newPct = ((clientX - left) / width) * 100
    setLeftPct(Math.min(75, Math.max(25, newPct)))
  }, [])

  // ── Scope tree to find tabs ────────────────────────────────────────────────
  const { data: treeItems } = useQuery<ScopeTreeItem[]>({
    queryKey: ['scope-tree', scopeId],
    queryFn: () => api.get(`/scope/${scopeId}/evaluation/tree`).then((r) => r.data),
  })

  const treeItemByKey = useMemo<Map<string, ScopeTreeItem>>(
    () => new Map((treeItems ?? []).map((i) => [i.issueKey, i])),
    [treeItems],
  )

  const [activeTabIdx, setActiveTabIdx] = useState(0)
  const [tabs, setTabs] = useState<TabState[]>([])
  const tabsInitRef = useRef(false)

  // Build tabs from tree (only once)
  useEffect(() => {
    if (!treeItems || tabsInitRef.current) return
    const target = treeItems.find((i) => i.issueKey === issueKey)
    if (!target) return

    tabsInitRef.current = true
    let keys: Array<{ key: string; type: 'EPIC' | 'FEATURE' | 'USERSTORY' }> = [
      { key: target.issueKey, type: target.issueType },
    ]
    if (target.issueType === 'EPIC') {
      const features = treeItems.filter(
        (i) => i.issueType === 'FEATURE' && i.parentKey === target.issueKey,
      )
      keys = [...keys, ...features.map((f) => ({ key: f.issueKey, type: 'FEATURE' as const }))]
    }
    setTabs(
      keys.map((k) => ({
        issueKey: k.key,
        issueType: k.type,
        proposal: null,
        attachments: [],
        jiraUpdatedAt: null,
        loading: false,
        error: null,
        dirty: false,
        highlightedFields: new Set(),
      })),
    )
  }, [treeItems, issueKey])

  // Init proposal when a tab is first activated
  const initTab = useCallback(
    async (idx: number, currentTabs: TabState[]) => {
      const tab = currentTabs[idx]
      if (!tab || tab.proposal || tab.loading) return
      setTabs((prev) =>
        prev.map((t, i) => (i === idx ? { ...t, loading: true, error: null } : t)),
      )
      try {
        await refreshToken()
        const result: ScopeProposalInitResult = await api
          .post(`/scope/${scopeId}/improvement/items/${tab.issueKey}/proposal/init`, {})
          .then((r) => r.data)
        setTabs((prev) =>
          prev.map((t, i) =>
            i === idx
              ? { ...t, proposal: result.proposal, attachments: result.attachments, jiraUpdatedAt: result.jiraUpdatedAt ?? null, loading: false }
              : t,
          ),
        )
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load proposal'
        setTabs((prev) =>
          prev.map((t, i) => (i === idx ? { ...t, loading: false, error: msg } : t)),
        )
      }
    },
    [scopeId],
  )

  // Trigger init when tabs list changes or active tab changes
  useEffect(() => {
    if (tabs.length > 0) initTab(activeTabIdx, tabs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.length, activeTabIdx])

  // ── Review: tracks which key is currently being reviewed ───────────────────
  const [reviewingKey, setReviewingKey] = useState<string | null>(null)

  // ── Save mutation ──────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ idx }: { idx: number }) => {
      const tab = tabs[idx]
      if (!tab?.proposal) return null
      return api
        .put(`/scope/${scopeId}/improvement/proposals/${tab.proposal.id}`, {
          proposedSummary:     tab.proposal.proposedSummary ?? null,
          proposedDescription: tab.proposal.proposedDescription ?? null,
          proposedCriteria:    tab.proposal.proposedCriteria ?? null,
          proposedTechnical:   tab.proposal.proposedTechnical ?? null,
          proposedLabel:       tab.proposal.proposedLabel ?? null,
          proposedPriority:    tab.proposal.proposedPriority ?? null,
        })
        .then((r) => r.data as ScopeProposal)
    },
    onSuccess: (data, { idx }) => {
      if (data) {
        setTabs((prev) =>
          prev.map((t, i) => (i === idx ? { ...t, proposal: data, dirty: false } : t)),
        )
        setToast({ message: 'Proposal saved', variant: 'success' })
      }
    },
    onError: () => setToast({ message: 'Save failed — check console', variant: 'error' }),
  })

  // ── Accept mutation ────────────────────────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: async ({ idx }: { idx: number }) => {
      const tab = tabs[idx]
      if (!tab?.proposal) return null
      await api.put(`/scope/${scopeId}/improvement/proposals/${tab.proposal.id}`, {
        proposedSummary:     tab.proposal.proposedSummary ?? null,
        proposedDescription: tab.proposal.proposedDescription ?? null,
        proposedCriteria:    tab.proposal.proposedCriteria ?? null,
        proposedTechnical:   tab.proposal.proposedTechnical ?? null,
        proposedLabel:       tab.proposal.proposedLabel ?? null,
        proposedPriority:    tab.proposal.proposedPriority ?? null,
      })
      return api
        .post(`/scope/${scopeId}/improvement/proposals/${tab.proposal.id}/accept`, {})
        .then((r) => r.data as ScopeProposal)
    },
    onSuccess: (data, { idx }) => {
      if (data) {
        setTabs((prev) =>
          prev.map((t, i) => (i === idx ? { ...t, proposal: data, dirty: false } : t)),
        )
        queryClient.invalidateQueries({ queryKey: ['scope-tree', scopeId] })
        setToast({
          message: `Synced to Jira${data.jiraResultKey ? `: ${data.jiraResultKey}` : ''}`,
          variant: 'success',
        })
      }
    },
    onError: () => setToast({ message: 'Jira sync failed — check console', variant: 'error' }),
  })

  // ── Review mutation (direct/synchronous) ──────────────────────────────────
  const reviewMutation = useMutation({
    mutationFn: async ({ key }: { key: string }) =>
      api
        .post(`/scope/${scopeId}/evaluation/items/${key}/review-direct`, {})
        .then((r) => r.data as JiraIssueReview),
    onMutate: ({ key }) => setReviewingKey(key),
    onSuccess: (_data, { key }) => {
      setReviewingKey(null)
      queryClient.invalidateQueries({ queryKey: ['scope-tree', scopeId] })
      setToast({ message: `Review updated for ${key}`, variant: 'success' })
    },
    onError: (_err, { key }) => {
      setReviewingKey(null)
      setToast({ message: `Review failed for ${key}`, variant: 'error' })
    },
  })

  // ── Delete mutation ────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: async ({ idx }: { idx: number }) => {
      const tab = tabs[idx]
      if (!tab?.proposal) return
      await api.delete(`/scope/${scopeId}/improvement/proposals/${tab.proposal.id}`)
    },
    onSuccess: (_data, { idx }) => {
      const deletedTab = tabs[idx]
      setTabs((prev) => prev.filter((_, i) => i !== idx))
      setActiveTabIdx((prev) => {
        if (prev === idx) return Math.max(0, idx - 1)
        if (prev > idx) return prev - 1
        return prev
      })
      setShowDeleteConfirm(false)
      queryClient.invalidateQueries({ queryKey: ['scope-tree', scopeId] })
      const isLinked = !deletedTab?.isNew
      setToast({
        message: isLinked
          ? `Proposal deleted. Remember to remove ${deletedTab.issueKey} in Jira if no longer needed.`
          : 'Proposal deleted.',
        variant: isLinked ? 'info' : 'success',
      })
    },
    onError: () => {
      setShowDeleteConfirm(false)
      setToast({ message: 'Delete failed — check console', variant: 'error' })
    },
  })

  // ── New-feature dialog ────────────────────────────────────────────────────
  const [showNewFeatureDialog, setShowNewFeatureDialog] = useState(false)
  const [newFeatureTitle, setNewFeatureTitle] = useState('')

  /** The EPIC key — set when the root tab is an EPIC. Drives the "Propose Features" toolbar. */
  const epicKey = tabs[0]?.issueType === 'EPIC' ? tabs[0].issueKey : null
  /** The active FEATURE key — set when the currently selected tab is a FEATURE. Drives the "Propose Stories" toolbar. */
  const activeFeatureKey = tabs[activeTabIdx]?.issueType === 'FEATURE' ? tabs[activeTabIdx].issueKey : null

  const addFeatureMutation = useMutation({
    mutationFn: async ({ parentKey, title }: { parentKey: string; title: string }) =>
      api
        .post(`/scope/${scopeId}/improvement/proposals/new-feature`, {
          parentKey,
          proposedSummary: title.trim() || undefined,
        })
        .then((r) => r.data as ScopeProposal),
    onSuccess: (proposal) => {
      const newTab: TabState = {
        issueKey:        proposal.issueKey,
        issueType:       'FEATURE',
        proposal,
        attachments:     [],
        jiraUpdatedAt:   null,
        loading:         false,
        error:           null,
        dirty:           false,
        highlightedFields: new Set(),
        isNew:           true,
      }
      setTabs((prev) => {
        const next = [...prev, newTab]
        setActiveTabIdx(next.length - 1)
        return next
      })
      setShowNewFeatureDialog(false)
      setNewFeatureTitle('')
      setToast({ message: 'New feature proposal created', variant: 'success' })
    },
    onError: () => setToast({ message: 'Failed to create feature proposal', variant: 'error' }),
  })

  // ── Propose features (AI) ─────────────────────────────────────────────────
  const proposeMutation = useMutation({
    mutationFn: async () =>
      api
        .post(`/scope/${scopeId}/improvement/items/${epicKey}/propose-features`, {})
        .then((r) => r.data as ScopeProposal[]),
    onSuccess: (proposals) => {
      if (!proposals.length) {
        setToast({ message: 'No missing features found — the Epic looks complete!', variant: 'info' })
        return
      }
      const newTabs: TabState[] = proposals.map((proposal) => ({
        issueKey:         proposal.issueKey,
        issueType:        'FEATURE' as const,
        proposal,
        attachments:      [],
        jiraUpdatedAt:    null,
        loading:          false,
        error:            null,
        dirty:            false,
        highlightedFields: new Set(),
        isNew:            true,
      }))
      setTabs((prev) => {
        const next = [...prev, ...newTabs]
        setActiveTabIdx(next.length - 1)
        return next
      })
      setToast({
        message: `${proposals.length} feature proposal${proposals.length > 1 ? 's' : ''} added`,
        variant: 'success',
      })
    },
    onError: () => setToast({ message: 'Feature analysis failed — try again', variant: 'error' }),
  })

  // ── Propose user stories (AI) — active FEATURE tab ────────────────────────
  const proposeStoriesMutation = useMutation({
    mutationFn: async (featureKey: string) =>
      api
        .post(`/scope/${scopeId}/improvement/items/${featureKey}/propose-stories`, {})
        .then((r) => r.data as ScopeProposal[]),
    onSuccess: (proposals) => {
      if (!proposals.length) {
        setToast({ message: 'No missing user stories found — the Feature looks complete!', variant: 'info' })
        return
      }
      const newTabs: TabState[] = proposals.map((proposal) => ({
        issueKey:         proposal.issueKey,
        issueType:        'USERSTORY' as const,
        proposal,
        attachments:      [],
        jiraUpdatedAt:    null,
        loading:          false,
        error:            null,
        dirty:            false,
        highlightedFields: new Set(),
        isNew:            true,
      }))
      setTabs((prev) => {
        const next = [...prev, ...newTabs]
        setActiveTabIdx(next.length - 1)
        return next
      })
      setToast({
        message: `${proposals.length} user stor${proposals.length > 1 ? 'ies' : 'y'} proposal${proposals.length > 1 ? 's' : ''} added`,
        variant: 'success',
      })
    },
    onError: () => setToast({ message: 'Story analysis failed — try again', variant: 'error' }),
  })

  // ── Field updates ──────────────────────────────────────────────────────────
  const updateField = (idx: number, field: keyof ScopeProposal, value: string) => {
    setTabs((prev) =>
      prev.map((t, i) =>
        i === idx
          ? { ...t, dirty: true, proposal: t.proposal ? { ...t.proposal, [field]: value } : t.proposal }
          : t,
      ),
    )
  }

  // ── Apply AI proposal update (proposal_updated SSE event) ─────────────────
  const applyProposalUpdate = useCallback(
    (proposalId: string, updatedFields: Partial<ScopeProposal>) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.proposal?.id !== proposalId) return t
          const prevMap = t.proposal as unknown as Record<string, unknown>
          const updMap = updatedFields as unknown as Record<string, unknown>
          const changed = new Set<string>(
            Object.keys(updatedFields).filter((k) => prevMap[k] !== updMap[k]),
          )
          return { ...t, proposal: { ...t.proposal, ...updatedFields }, dirty: true, highlightedFields: changed }
        }),
      )
      setTimeout(() => {
        setTabs((prev) =>
          prev.map((t) =>
            t.proposal?.id === proposalId ? { ...t, highlightedFields: new Set() } : t,
          ),
        )
      }, 1500)
    },
    [],
  )

  // ── Chat state ─────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingThinkingSteps, setStreamingThinkingSteps] = useState<ThinkingStep[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const chatInputRef = useRef<ChatInputHandle>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamingContentRef = useRef('')
  const streamingRafRef = useRef<number | null>(null)
  const { scrollToBottom: scrollChatToBottom } = useSmoothScrollToBottom(chatScrollRef)

  useEffect(() => {
    scrollChatToBottom()
  }, [chatMessages, scrollChatToBottom])

  useEffect(() => {
    if (isStreaming && streamingContent) scrollChatToBottom()
  }, [streamingContent, isStreaming, scrollChatToBottom])

  const sendMessage = useCallback(
    async (
      text: string,
      _attachmentIds?: string[],
      mode?: string,
      conversationContext?: ConversationContext,
    ) => {
      if (!text.trim() || isStreaming) return

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text.trim() }
      setChatMessages((prev) => [...prev, userMsg])
      setIsStreaming(true)
      setStreamingContent('')
      setStreamingThinkingSteps([])
      streamingContentRef.current = ''
      if (streamingRafRef.current) {
        cancelAnimationFrame(streamingRafRef.current)
        streamingRafRef.current = null
      }

      const proposalIds = tabs.map((t) => t.proposal?.id).filter(Boolean) as string[]
      // Use the active tab's key so the backend receives the correct issue type for the prompt.
      // Falling back to the route-level issueKey keeps things safe if tabs haven't loaded yet.
      const activeIssueKey = tabs[activeTabIdx]?.issueKey ?? issueKey
      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        await refreshToken()
        const token = getToken()
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/scope/${scopeId}/improvement/items/${activeIssueKey}/improve-chat`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              Accept: 'text/event-stream',
            },
            body: JSON.stringify({
              message: text.trim(),
              ...(conversationId ? { conversationId } : {}),
              proposalIds,
              ...(conversationContext ? { conversationContext } : {}),
              ...(mode ? { mode } : {}),
            }),
          },
        )

        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let accContent = ''
        const accThinking: ThinkingStep[] = []

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
            let event: Record<string, unknown>
            try {
              event = JSON.parse(raw)
            } catch {
              continue
            }

            switch (event.type) {
              case 'text':
                accContent += (event.text as string) ?? ''
                streamingContentRef.current = accContent
                if (!streamingRafRef.current) {
                  streamingRafRef.current = requestAnimationFrame(() => {
                    setStreamingContent(streamingContentRef.current)
                    streamingRafRef.current = null
                  })
                }
                break
              case 'thinking': {
                const last = accThinking[accThinking.length - 1]
                if (last?.kind === 'thought') last.text += (event.text as string) ?? ''
                else accThinking.push({ kind: 'thought', text: (event.text as string) ?? '' })
                setStreamingThinkingSteps([...accThinking])
                break
              }
              case 'tool_start':
                accThinking.push({
                  kind: 'tool',
                  name: (event.tool as string) ?? '',
                  input: event.input as Record<string, unknown>,
                  status: 'running',
                  startTime: (event.timestamp as number) ?? Date.now(),
                })
                setStreamingThinkingSteps([...accThinking])
                break
              case 'tool_end': {
                const last = [...accThinking]
                  .reverse()
                  .find((s) => s.kind === 'tool' && s.name === event.tool && s.status === 'running')
                if (last && last.kind === 'tool') {
                  last.status = (event.result as string)?.startsWith('ERROR:') ? 'error' : 'completed'
                  last.result = event.result as string
                  last.endTime = (event.timestamp as number) ?? Date.now()
                }
                setStreamingThinkingSteps([...accThinking])
                break
              }
              case 'proposal_updated': {
                const pid = event.proposalId as string
                const proposal = event.proposal as Partial<ScopeProposal>
                if (pid && proposal) applyProposalUpdate(pid, proposal)
                break
              }
              case 'done':
                if (event.conversationId) setConversationId(event.conversationId as string)
                break
            }
          }
        }

        if (accContent) {
          const webSources = extractWebSources(accThinking)
          const assistantMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: accContent,
            thinkingSteps: accThinking.length > 0 ? accThinking : undefined,
            webSources: webSources.length > 0 ? webSources : undefined,
          }
          setChatMessages((prev) => [...prev, assistantMsg])
        }
        // Cancel any pending RAF and flush the final accumulated content
        if (streamingRafRef.current) {
          cancelAnimationFrame(streamingRafRef.current)
          streamingRafRef.current = null
        }
        setStreamingContent('')
        setStreamingThinkingSteps([])
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          console.error('ScopeImprove chat error:', err)
        }
        if (streamingRafRef.current) {
          cancelAnimationFrame(streamingRafRef.current)
          streamingRafRef.current = null
        }
        setStreamingContent('')
        setStreamingThinkingSteps([])
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [isStreaming, conversationId, scopeId, issueKey, tabs, activeTabIdx, applyProposalUpdate],
  )

  const stopStreaming = () => abortControllerRef.current?.abort()

  // ── Scope name for breadcrumb ──────────────────────────────────────────────
  const { data: scope } = useQuery<{ name: string }>({
    queryKey: ['scope', scopeId],
    queryFn: () => api.get(`/scope/${scopeId}`).then((r) => r.data),
  })

  // ── Jira base URL (for issue key links) ───────────────────────────────────
  const { data: systemConfig } = useQuery<SystemConfig>({
    queryKey: ['mcp-system-config'],
    queryFn: () => mcpProfilesApi.getSystemConfig(),
    staleTime: 5 * 60 * 1000,
  })
  const jiraBaseUrl = systemConfig?.jira?.baseUrl?.replace(/\/$/, '') ?? ''

  const activeTab = tabs[activeTabIdx]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[var(--color-page-background)]">
      {/* ── Topbar / breadcrumb ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-5 py-3 bg-[var(--color-cards-card-background)] shrink-0">
        <Tooltip text={`Back to ${scope?.name ?? 'scope'}`}>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={13} />}
            onClick={() => navigate({ to: '/metrics/scope/$id', params: { id: scopeId } })}
          >
            {scope?.name ?? 'Scope'}
          </Button>
        </Tooltip>
        <span className="text-[var(--color-fonts-font-color-support)] text-xs">/</span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-fonts-font-color-primary)]">
          <IssueTypeIcon issueType={tabs[0]?.issueType ?? 'EPIC'} size={12} />
          <JiraIssueLink issueKey={issueKey} jiraBaseUrl={jiraBaseUrl} />
          {treeItemByKey.get(issueKey)?.summary && (
            <>
              <span className="text-[var(--color-fonts-font-color-support)] font-normal">—</span>
              <span>{treeItemByKey.get(issueKey)!.summary}</span>
            </>
          )}
        </span>
      </div>

      {/* ── Main split ────────────────────────────────────────────────────── */}
      <div ref={splitContainerRef} className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left Panel: Proposal Editor ──────────────────────────────────── */}
        <div style={{ width: `${leftPct}%` }} className="flex flex-col min-h-0 shrink-0">
          {/* Tab bar */}
          <TabBar className="px-4 shrink-0 bg-[var(--color-cards-card-background)]">
            {tabs.map((tab, idx) => {
              const ti = treeItemByKey.get(tab.issueKey)

              return (
                <TabButton
                  key={tab.issueKey}
                  active={idx === activeTabIdx}
                  onClick={() => setActiveTabIdx(idx)}
                >
                  {/* Type icon with tooltip */}
                  <IssueTypeIcon issueType={tab.issueType} size={13} />

                  {/* Issue key (Jira link) or new-tab summary */}
                  {tab.isNew ? (
                    <span>
                      {tab.proposal?.proposedSummary
                        ? tab.proposal.proposedSummary.length > 28
                          ? tab.proposal.proposedSummary.slice(0, 28) + '…'
                          : tab.proposal.proposedSummary
                        : tab.issueType === 'USERSTORY' ? 'New story' : 'New feature'}
                    </span>
                  ) : (
                    <JiraIssueLink issueKey={tab.issueKey} jiraBaseUrl={jiraBaseUrl} />
                  )}

                  {/* Readiness score — spinner while reviewing, coloured number otherwise */}
                  {reviewingKey === tab.issueKey ? (
                    <Tooltip text="Reviewing…">
                      <Loader2 size={10} className="animate-spin text-[var(--color-fonts-font-color-support)]" />
                    </Tooltip>
                  ) : ti?.readinessScore != null && ti.readinessLabel ? (
                    <Tooltip text={ti.readinessLabel.replace(/_/g, ' ')}>
                      <span className={`text-[10px] font-bold tabular-nums ${SCORE_COLOR[ti.readinessLabel] ?? 'text-[var(--color-fonts-font-color-support)]'}`}>
                        {ti.readinessScore}
                      </span>
                    </Tooltip>
                  ) : null}

                  {/* Unsaved-changes dot */}
                  {tab.dirty && (
                    <span className="text-[var(--color-buttons-button-primary)]">•</span>
                  )}
                </TabButton>
              )
            })}

            {/* Add new feature — only available when the root issue is an EPIC */}
            {epicKey && (
              <Tooltip text="Add a new feature proposal">
                <button
                  type="button"
                  onClick={() => setShowNewFeatureDialog(true)}
                  className="flex items-center justify-center w-7 h-7 ml-1 rounded hover:bg-[var(--color-buttons-button-secondary-hover)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
                >
                  <Plus size={14} />
                </button>
              </Tooltip>
            )}
          </TabBar>

          {/* AI toolbar — shown only for EPICs */}
          {epicKey && (
            <div className="flex items-center gap-2 px-4 py-1.5 shrink-0 bg-[var(--color-page-background)] border-b border-[var(--color-borders-border-primary)]/40">
              <Tooltip text="Let AI analyse the Epic and propose missing features">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Wand2 size={12} />}
                  loading={proposeMutation.isPending}
                  disabled={proposeMutation.isPending}
                  onClick={() => proposeMutation.mutate()}
                >
                  Check &amp; Propose Features
                </Button>
              </Tooltip>
              {proposeMutation.isPending && (
                <span className="text-[11px] text-[var(--color-fonts-font-color-support)] animate-pulse">
                  Analysing epic…
                </span>
              )}
            </div>
          )}

          {/* AI toolbar — shown only for the active FEATURE tab when the main issue is itself a Feature */}
          {activeFeatureKey && !epicKey && (
            <div className="flex items-center gap-2 px-4 py-1.5 shrink-0 bg-[var(--color-page-background)] border-b border-[var(--color-borders-border-primary)]/40">
              <Tooltip text="Let AI analyse the Feature and propose missing user stories">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Wand2 size={12} />}
                  loading={proposeStoriesMutation.isPending}
                  disabled={proposeStoriesMutation.isPending}
                  onClick={() => proposeStoriesMutation.mutate(activeFeatureKey)}
                >
                  Check &amp; Propose User Stories
                </Button>
              </Tooltip>
              {proposeStoriesMutation.isPending && (
                <span className="text-[11px] text-[var(--color-fonts-font-color-support)] animate-pulse">
                  Analysing feature…
                </span>
              )}
            </div>
          )}

          {/* Tab content — flex column so ProposalForm can fill remaining height */}
          <div className="flex-1 flex flex-col min-h-0 py-5 pl-5 pr-4">
            {!activeTab ? (
              <EmptyState message="Loading scope items…" />
            ) : activeTab.loading ? (
              <EmptyState message="Loading proposal from Jira…" loading />
            ) : activeTab.error ? (
              <div className="rounded border border-[var(--color-status-border-critical)] bg-[var(--color-tags-critical-background)] p-3 text-xs text-[var(--color-tags-font-critical)]">
                {activeTab.error}
              </div>
            ) : activeTab.proposal ? (
              <ProposalForm
                tab={activeTab}
                tabIdx={activeTabIdx}
                onFieldChange={updateField}
                treeItem={treeItemByKey.get(activeTab.issueKey)}
                isReviewing={reviewingKey === activeTab.issueKey}
                scopeId={scopeId}
              />
            ) : null}
          </div>

          {/* Footer actions */}
          {activeTab?.proposal && (
            <div className="flex items-center gap-3 px-5 py-3 shrink-0 bg-[var(--color-cards-card-background)] border-t border-[var(--color-borders-border-primary)]/40">
              {activeTab.proposal.status === 'ACCEPTED' ? (
                <div className="flex items-center gap-2 text-[var(--color-tags-font-success)] text-xs font-medium">
                  <CheckCircle2 size={14} />
                  Synced to Jira
                  {activeTab.proposal.jiraResultKey && (
                    <a
                      href="#"
                      className="underline underline-offset-2 text-[var(--color-buttons-button-primary)] flex items-center gap-1"
                    >
                      {activeTab.proposal.jiraResultKey}
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              ) : (
                <>
                  <Tooltip text="Save proposal edits to the database">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Save size={11} />}
                      loading={saveMutation.isPending}
                      disabled={!activeTab.dirty || saveMutation.isPending}
                      onClick={() => saveMutation.mutate({ idx: activeTabIdx })}
                    >
                      Save
                    </Button>
                  </Tooltip>

                  <Tooltip text="Run an AI readiness review for this issue">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Sparkles size={11} />}
                      loading={reviewMutation.isPending || reviewingKey === activeTab.issueKey}
                      disabled={reviewMutation.isPending || reviewingKey === activeTab.issueKey}
                      onClick={() => reviewMutation.mutate({ key: activeTab.issueKey })}
                    >
                      Review
                    </Button>
                  </Tooltip>

                  <Tooltip text="Save and push changes back to Jira">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<CheckCircle2 size={11} />}
                      loading={acceptMutation.isPending}
                      disabled={acceptMutation.isPending}
                      onClick={() => acceptMutation.mutate({ idx: activeTabIdx })}
                    >
                      Accept &amp; Sync to Jira
                    </Button>
                  </Tooltip>
                </>
              )}

              {/* Delete — only for Feature / User Story tabs */}
              {activeTab.issueType !== 'EPIC' && (
                <>
                  <div className="w-px h-4 bg-[var(--color-borders-border-primary)]/60 mx-1" />
                  <Tooltip text="Delete this proposal from the database">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Trash2 size={11} />}
                      disabled={deleteMutation.isPending}
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-[var(--color-tags-font-critical)] hover:border-[var(--color-tags-font-critical)]/40"
                    >
                      Delete
                    </Button>
                  </Tooltip>
                </>
              )}

              {/* Audit metadata */}
              <div className="ml-auto flex items-center gap-3 text-[11px] text-[var(--color-fonts-font-color-support)]">
                {/* Out-of-sync warning: Jira was modified after the proposal was last saved */}
                {activeTab.jiraUpdatedAt && activeTab.proposal.updatedAt &&
                  new Date(activeTab.jiraUpdatedAt) > new Date(activeTab.proposal.updatedAt) && (
                  <Tooltip text={`Jira was modified ${fmtDate(activeTab.jiraUpdatedAt)} — your proposal may be out of date`}>
                    <span className="flex items-center gap-1 text-amber-500 font-medium cursor-default">
                      <AlertTriangle size={12} />
                      Out of sync
                    </span>
                  </Tooltip>
                )}

                {/* Jira last modified */}
                {activeTab.jiraUpdatedAt && (
                  <Tooltip text={`Jira last modified: ${new Date(activeTab.jiraUpdatedAt).toLocaleString()}`}>
                    <span className="cursor-default">
                      Jira {fmtDate(activeTab.jiraUpdatedAt)}
                    </span>
                  </Tooltip>
                )}

                {/* Last review timestamp */}
                {(() => {
                  const ti = treeItemByKey.get(activeTab.issueKey)
                  if (!ti?.reviewedAt) return null
                  return reviewingKey === activeTab.issueKey ? (
                    <span className="flex items-center gap-1 animate-pulse">
                      <Loader2 size={10} className="animate-spin" />
                      Reviewing…
                    </span>
                  ) : (
                    <Tooltip text={`Last reviewed: ${new Date(ti.reviewedAt).toLocaleString()}`}>
                      <span className="cursor-default flex items-center gap-1">
                        <Sparkles size={10} />
                        {fmtDate(ti.reviewedAt)}
                      </span>
                    </Tooltip>
                  )
                })()}

                {activeTab.proposal.status === 'ACCEPTED' && activeTab.proposal.updatedAt && (
                  <Tooltip text={new Date(activeTab.proposal.updatedAt).toLocaleString()}>
                    <span>
                      Synced {fmtDate(activeTab.proposal.updatedAt)}
                      {activeTab.proposal.syncedBy && (
                        <span className="font-medium text-[var(--color-fonts-font-color-primary)]">
                          {' '}by {activeTab.proposal.syncedBy}
                        </span>
                      )}
                    </span>
                  </Tooltip>
                )}
                {activeTab.proposal.status !== 'ACCEPTED' && activeTab.proposal.updatedAt && (
                  <Tooltip text={new Date(activeTab.proposal.updatedAt).toLocaleString()}>
                    <span>
                      Saved {fmtDate(activeTab.proposal.updatedAt)}
                      {activeTab.proposal.updatedBy && (
                        <span className="font-medium text-[var(--color-fonts-font-color-primary)]">
                          {' '}by {activeTab.proposal.updatedBy}
                        </span>
                      )}
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Resizable vertical divider */}
        <ResizableDivider onDrag={handleSplitDrag} />

        {/* ── Right Panel: Product Owner Chat (42%) ───────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 bg-[var(--color-page-background)]">
          {/* Chat header */}
          <div className="flex items-center gap-2 px-4 bg-[var(--color-cards-card-background)] shrink-0">
            <Sparkles size={13} className="text-violet-500" />
            <TabBar className="flex-1">
              <TabButton active onClick={() => {}}>
                Product Owner AI
              </TabButton>
            </TabBar>
            <span className="text-[10px] text-[var(--color-fonts-font-color-support)] pr-2">
              Edits land in the form live
            </span>
          </div>

          {/* Messages */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-12">
                <Sparkles size={28} className="text-violet-400 opacity-50" />
                <p className="text-sm text-[var(--color-fonts-font-color-support)]">
                  Ask the Product Owner AI to help refine this proposal.
                </p>
                {/* Clickable prompt suggestions — vary by active tab type */}
                <div className="grid grid-cols-2 gap-2 w-full max-w-sm mt-1">
                  {(SUGGESTED_PROMPTS[activeTab?.issueType ?? 'EPIC'] ?? SUGGESTED_PROMPTS.EPIC).map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => sendMessage(p.prompt)}
                      className={[
                        'text-left px-3 py-2.5 rounded-xl text-xs leading-snug',
                        'border border-[var(--color-borders-border-primary)]',
                        'bg-[var(--color-cards-card-background)]',
                        'text-[var(--color-fonts-font-color-primary)]',
                        'hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30',
                        'transition-colors cursor-pointer',
                      ].join(' ')}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center shrink-0">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  {streamingThinkingSteps.length > 0 && (
                    <ThinkingPanel steps={streamingThinkingSteps} isLive={true} />
                  )}
                  {streamingContent ? (
                    <StreamingMarkdownMessage content={streamingContent} isStreaming={true} />
                  ) : (
                    streamingThinkingSteps.length === 0 && (
                      <span className="text-[var(--color-fonts-font-color-support)] text-sm italic">
                        Thinking…
                      </span>
                    )
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input — no canPlan so Plan mode is hidden; Ask mode available */}
          <ChatInputBar
            ref={chatInputRef}
            isStreaming={isStreaming}
            conversationId={conversationId ?? undefined}
            onSend={sendMessage}
            onStop={stopStreaming}
            onSecretWarning={() => {}}
          />
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && activeTab?.proposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg bg-[var(--color-cards-card-background)] shadow-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]">
                <Trash2 size={15} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
                  Delete proposal?
                </h2>
                <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1 leading-relaxed">
                  The proposal for <span className="font-medium text-[var(--color-fonts-font-color-primary)]">{activeTab.issueKey}</span> will be permanently removed from the database.
                </p>
              </div>
            </div>

            {/* Jira notice — only for linked (non-new) proposals */}
            {!activeTab.isNew && (
              <div className="flex items-start gap-2 mb-5 p-3 rounded-lg bg-[var(--color-tags-attention-background)] border border-[var(--color-tags-font-attention)]/20">
                <AlertTriangle size={13} className="shrink-0 mt-0.5 text-[var(--color-tags-font-attention)]" />
                <p className="text-[11px] text-[var(--color-tags-font-attention)] leading-relaxed">
                  The linked Jira issue <span className="font-semibold">{activeTab.issueKey}</span> will <strong>not</strong> be deleted automatically. Please remove it in Jira yourself if it is no longer needed.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon={<Trash2 size={12} />}
                loading={deleteMutation.isPending}
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ idx: activeTabIdx })}
              >
                Delete proposal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New-feature dialog */}
      {showNewFeatureDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg bg-[var(--color-cards-card-background)] shadow-xl p-6">
            <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] mb-4">
              New Feature Proposal
            </h2>
            <div className="mb-5">
              <label className="block text-xs font-medium text-[var(--color-fonts-font-color-support)] mb-1.5">
                Feature title
              </label>
              <Input
                value={newFeatureTitle}
                onChange={(e) => setNewFeatureTitle(e.target.value)}
                placeholder="e.g. Add dark mode toggle"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFeatureTitle.trim() && epicKey)
                    addFeatureMutation.mutate({ parentKey: epicKey, title: newFeatureTitle })
                  if (e.key === 'Escape') {
                    setShowNewFeatureDialog(false)
                    setNewFeatureTitle('')
                  }
                }}
              />
              <p className="mt-1.5 text-[11px] text-[var(--color-fonts-font-color-support)]">
                A new draft proposal will be created under <span className="font-medium">{epicKey}</span>.
                A Jira issue is only created when you <em>Accept &amp; Sync</em>.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => { setShowNewFeatureDialog(false); setNewFeatureTitle('') }}
                disabled={addFeatureMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<Plus size={12} />}
                loading={addFeatureMutation.isPending}
                disabled={!newFeatureTitle.trim() || addFeatureMutation.isPending}
                onClick={() => epicKey && addFeatureMutation.mutate({ parentKey: epicKey, title: newFeatureTitle })}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Attachments tab ────────────────────────────────────────────────────────────

function mimeIcon(mimeType: string) {
  if (mimeType.startsWith('image/'))  return <FileImage  size={15} className="text-blue-400 shrink-0" />
  if (mimeType.startsWith('video/'))  return <FileVideo  size={15} className="text-purple-400 shrink-0" />
  if (mimeType.startsWith('audio/'))  return <FileAudio  size={15} className="text-pink-400 shrink-0" />
  if (mimeType === 'application/pdf') return <FileText   size={15} className="text-red-400 shrink-0" />
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('archive'))
                                      return <FileArchive size={15} className="text-amber-400 shrink-0" />
  return                                     <FileText   size={15} className="text-[var(--color-fonts-font-color-support)] shrink-0" />
}

function fmtSize(bytes: number) {
  if (bytes < 1024)           return `${bytes} B`
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(0)} KB`
  return                             `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function AttachmentsTab({ scopeId, issueKey, isNew }: { scopeId: string; issueKey: string; isNew: boolean }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<JiraAttachment[]>({
    queryKey: ['attachments', scopeId, issueKey],
    queryFn: () =>
      api
        .get<JiraAttachment[]>(`/scope/${scopeId}/items/${issueKey}/attachments-list`)
        .then((r) => r.data),
    enabled: !isNew,
    staleTime: 60_000,
  })

  if (isNew) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Paperclip size={24} className="text-[var(--color-fonts-font-color-support)] opacity-30" />
        <p className="text-[12px] text-[var(--color-fonts-font-color-support)]">
          Attachments are only available for saved Jira issues.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-2 pt-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-borders-border-primary)]/40 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-borders-border-primary)]/30 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 rounded bg-[var(--color-borders-border-primary)]/30 w-2/3" />
              <div className="h-2.5 rounded bg-[var(--color-borders-border-primary)]/20 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertTriangle size={22} className="text-amber-400 opacity-60" />
        <p className="text-[12px] text-[var(--color-fonts-font-color-support)]">
          Could not load attachments from Jira.
        </p>
        <button
          onClick={() => refetch()}
          className="text-[11px] text-[var(--color-buttons-button-primary)] hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Paperclip size={24} className="text-[var(--color-fonts-font-color-support)] opacity-30" />
        <p className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">No attachments</p>
        <p className="text-[12px] text-[var(--color-fonts-font-color-support)]">
          This issue has no files attached in Jira.
        </p>
      </div>
    )
  }

  const proxyUrl = (contentUrl: string) =>
    `${import.meta.env.VITE_API_URL}/scope/${scopeId}/items/${issueKey}/attachments?url=${encodeURIComponent(contentUrl)}`

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto pt-1 space-y-1.5">
      {/* Header row */}
      <div className="flex items-center justify-between shrink-0 mb-1">
        <p className="text-[11px] text-[var(--color-fonts-font-color-support)]">
          {data.length} file{data.length !== 1 ? 's' : ''} attached in Jira
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-[11px] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors flex items-center gap-1 disabled:opacity-40"
        >
          {isFetching ? <Loader2 size={10} className="animate-spin" /> : null}
          Refresh
        </button>
      </div>

      {data.map((att) => (
        <div
          key={att.id}
          className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--color-borders-border-primary)]/50 bg-[var(--color-cards-card-background)] hover:border-[var(--color-borders-border-primary)] transition-colors"
        >
          {/* Icon */}
          <div className="w-8 h-8 rounded-lg bg-[var(--color-page-background)] flex items-center justify-center border border-[var(--color-borders-border-primary)]/40 shrink-0">
            {mimeIcon(att.mimeType)}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-[var(--color-fonts-font-color-primary)] truncate">
              {att.filename}
            </p>
            <p className="text-[10px] text-[var(--color-fonts-font-color-support)]">
              {fmtSize(att.size)} · {att.mimeType}
            </p>
          </div>

          {/* Download */}
          <a
            href={proxyUrl(att.contentUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-[var(--color-page-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]"
            title={`Download ${att.filename}`}
          >
            <Download size={13} />
          </a>
        </div>
      ))}
    </div>
  )
}

// ── Review sub-components ──────────────────────────────────────────────────────

const REVIEW_CONFIG: Record<string, { label: string; textColor: string; barColor: string; bgColor: string }> = {
  poor:                          { label: 'Poor',                          textColor: 'text-red-500 dark:text-red-400',          barColor: 'bg-red-500',     bgColor: 'bg-red-50 dark:bg-red-950/20' },
  needs_refinement:              { label: 'Needs refinement',              textColor: 'text-amber-500 dark:text-amber-400',       barColor: 'bg-amber-500',   bgColor: 'bg-amber-50 dark:bg-amber-950/20' },
  ready_with_minor_improvements: { label: 'Ready with minor improvements', textColor: 'text-blue-500 dark:text-blue-400',         barColor: 'bg-blue-500',    bgColor: 'bg-blue-50 dark:bg-blue-950/20' },
  fully_ready:                   { label: 'Fully ready',                   textColor: 'text-emerald-500 dark:text-emerald-400',   barColor: 'bg-emerald-500', bgColor: 'bg-emerald-50 dark:bg-emerald-950/20' },
}

function complexityColor(score: number) {
  if (score >= 70) return { text: 'text-red-500 dark:text-red-400',    bar: 'bg-red-500' }
  if (score >= 40) return { text: 'text-amber-500 dark:text-amber-400', bar: 'bg-amber-500' }
  return               { text: 'text-emerald-500 dark:text-emerald-400', bar: 'bg-emerald-500' }
}

function ReviewResult({ treeItem }: { treeItem: ScopeTreeItem }) {
  const cfg = REVIEW_CONFIG[treeItem.readinessLabel ?? ''] ?? {
    label: treeItem.readinessLabel ?? 'Unknown',
    textColor: 'text-[var(--color-fonts-font-color-support)]',
    barColor: 'bg-[var(--color-borders-border-primary)]',
    bgColor: '',
  }
  const score = treeItem.readinessScore ?? 0
  const cx = treeItem.complexityScore != null ? complexityColor(treeItem.complexityScore) : null

  return (
    <div className="space-y-6 pt-1">
      {/* Scores ─────────────────────────────────────────────────────── */}
      <div>
        {/* Readiness hero */}
        <div className="flex items-end justify-between gap-2 mb-3">
          <div className="flex items-baseline gap-2">
            <span className={`text-5xl font-bold tabular-nums leading-none ${cfg.textColor}`}>
              {score}
            </span>
            <span className="text-sm text-[var(--color-fonts-font-color-support)] leading-none pb-0.5">
              / 100
            </span>
          </div>
          <span className={`text-sm font-semibold ${cfg.textColor}`}>{cfg.label}</span>
        </div>

        {/* Readiness bar */}
        <div className="h-1.5 rounded-full bg-[var(--color-borders-border-primary)]/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${cfg.barColor}`}
            style={{ width: `${score}%` }}
          />
        </div>

        {/* Complexity row */}
        {cx && treeItem.complexityScore != null && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-borders-border-primary)]/30">
            <Tooltip text="AI complexity estimate (0–100). Lower = simpler. Higher = more effort, uncertainty, or dependencies.">
              <span className="text-[11px] text-[var(--color-fonts-font-color-support)] cursor-default">
                Complexity
              </span>
            </Tooltip>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 rounded-full bg-[var(--color-borders-border-primary)]/40 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${cx.bar}`}
                  style={{ width: `${treeItem.complexityScore}%` }}
                />
              </div>
              <span className={`text-[11px] font-semibold tabular-nums ${cx.text}`}>
                {treeItem.complexityScore}
              </span>
            </div>
          </div>
        )}

        {/* Aggregate row */}
        {treeItem.aggregateScore != null && (() => {
          const aggCfg = treeItem.aggregateScore >= 70
            ? { bar: 'bg-emerald-500', text: 'text-emerald-500 dark:text-emerald-400' }
            : treeItem.aggregateScore >= 40
              ? { bar: 'bg-amber-500',   text: 'text-amber-500 dark:text-amber-400' }
              : { bar: 'bg-red-500',     text: 'text-red-500 dark:text-red-400' }
          return (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-borders-border-primary)]/30">
              <Tooltip text="Overall health: 40% own writing quality + 60% child items average. 0 = not yet decomposed into children.">
                <span className="text-[11px] text-[var(--color-fonts-font-color-support)] cursor-default">
                  Aggregate
                </span>
              </Tooltip>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 rounded-full bg-[var(--color-borders-border-primary)]/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${aggCfg.bar}`}
                    style={{ width: `${treeItem.aggregateScore}%` }}
                  />
                </div>
                <span className={`text-[11px] font-semibold tabular-nums ${aggCfg.text}`}>
                  {treeItem.aggregateScore}
                </span>
              </div>
            </div>
          )
        })()}

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-3">
          {treeItem.reviewedAt && (
            <span className="text-[11px] text-[var(--color-fonts-font-color-support)]">
              Reviewed {fmtDate(treeItem.reviewedAt)}
            </span>
          )}
          {treeItem.isStale && (
            <Tooltip text="Jira was modified after this review — save &amp; re-review for an up-to-date score">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 cursor-default">
                <AlertTriangle size={10} />
                Stale
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Improvement suggestions ─────────────────────────────────────── */}
      {treeItem.improvementSummary && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-fonts-font-color-support)] mb-2">
            Suggestions
          </p>
          <p className="text-[13px] text-[var(--color-fonts-font-color-primary)] leading-relaxed whitespace-pre-line">
            {treeItem.improvementSummary}
          </p>
        </div>
      )}
    </div>
  )
}

function ReviewLoadingState({
  prevScore,
  prevLabel,
}: {
  prevScore?: number | null
  prevLabel?: string | null
}) {
  const cfg = REVIEW_CONFIG[prevLabel ?? '']
  return (
    <div className="space-y-6 pt-1">
      {/* Shimmer score placeholder */}
      <div>
        <div className="flex items-end justify-between gap-2 mb-3">
          <div className="flex items-baseline gap-2">
            {prevScore != null && cfg ? (
              <span className={`text-5xl font-bold tabular-nums leading-none opacity-30 ${cfg.textColor}`}>
                {prevScore}
              </span>
            ) : (
              <span className="w-16 h-10 rounded-lg bg-[var(--color-borders-border-primary)]/30 animate-pulse inline-block" />
            )}
            <span className="text-sm text-[var(--color-fonts-font-color-support)] opacity-30 leading-none pb-0.5">
              / 100
            </span>
          </div>
          <span className="w-28 h-4 rounded bg-[var(--color-borders-border-primary)]/30 animate-pulse inline-block" />
        </div>
        <div className="h-1.5 rounded-full bg-[var(--color-borders-border-primary)]/30 animate-pulse" />
        <div className="flex items-center gap-2 mt-3 text-[11px] text-[var(--color-fonts-font-color-support)]">
          <Loader2 size={11} className="animate-spin shrink-0" />
          <span>Running AI readiness review…</span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-2.5 rounded bg-[var(--color-borders-border-primary)]/20 animate-pulse w-16" />
        <div className="h-3 rounded bg-[var(--color-borders-border-primary)]/20 animate-pulse w-full" />
        <div className="h-3 rounded bg-[var(--color-borders-border-primary)]/20 animate-pulse w-4/5" />
        <div className="h-3 rounded bg-[var(--color-borders-border-primary)]/20 animate-pulse w-5/6" />
      </div>
    </div>
  )
}

function ReviewEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--color-borders-border-primary)]/10 flex items-center justify-center">
        <Sparkles size={22} className="text-violet-400 opacity-50" />
      </div>
      <p className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">No review yet</p>
      <p className="text-[12px] text-[var(--color-fonts-font-color-support)] max-w-[220px] leading-relaxed">
        Save the proposal to trigger an automatic review, or click{' '}
        <span className="font-medium text-[var(--color-fonts-font-color-primary)]">Review</span> in the
        footer.
      </p>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ message, loading }: { message: string; loading?: boolean }) {
  return (
    <div className="flex items-center justify-center h-32 gap-2 text-sm text-[var(--color-fonts-font-color-support)]">
      {loading && (
        <svg
          className="animate-spin w-4 h-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      )}
      {message}
    </div>
  )
}

// ── Proposal form sub-component ────────────────────────────────────────────────

function ProposalForm({
  tab,
  tabIdx,
  onFieldChange,
  treeItem,
  isReviewing = false,
  scopeId,
}: {
  tab: TabState
  tabIdx: number
  onFieldChange: (idx: number, field: keyof ScopeProposal, value: string) => void
  treeItem?: ScopeTreeItem
  isReviewing?: boolean
  scopeId: string
}) {
  const [fieldTab, setFieldTab] = useState<'content' | 'details' | 'attachments' | 'review'>('content')
  const proposal = tab.proposal!
  const locked = proposal.status === 'ACCEPTED'

  // Auto-switch to Review tab when a review starts or finishes
  useEffect(() => {
    if (isReviewing) setFieldTab('review')
  }, [isReviewing])

  // Also switch when a fresh result arrives (treeItem gains a score for the first time)
  const prevHadReview = useRef(!!treeItem?.readinessScore)
  useEffect(() => {
    const hasReview = !!treeItem?.readinessScore
    if (hasReview && !prevHadReview.current) setFieldTab('review')
    prevHadReview.current = hasReview
  }, [treeItem?.readinessScore])

  const highlightClass = (field: string) =>
    tab.highlightedFields.has(field)
      ? 'ring-2 ring-[var(--color-buttons-button-primary)]/50 border-[var(--color-buttons-button-primary)]'
      : ''

  const labelClass =
    'block text-[11px] font-medium text-[var(--color-fonts-font-color-support)] mb-1'

  const reviewLabel = treeItem?.readinessLabel
  const reviewScore = treeItem?.readinessScore

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Inner tab bar: Content / Details / Attachments / Review */}
      <TabBar className="shrink-0 mb-4">
        <TabButton active={fieldTab === 'content'} onClick={() => setFieldTab('content')}>
          Content
        </TabButton>
        <TabButton active={fieldTab === 'details'} onClick={() => setFieldTab('details')}>
          Details
        </TabButton>
        <TabButton active={fieldTab === 'attachments'} onClick={() => setFieldTab('attachments')}>
          Attachments
        </TabButton>
        <TabButton active={fieldTab === 'review'} onClick={() => setFieldTab('review')}>
          <span className="flex items-center gap-1.5">
            Review
            {isReviewing ? (
              <Loader2 size={10} className="animate-spin text-[var(--color-fonts-font-color-support)]" />
            ) : reviewScore != null && reviewLabel ? (
              <span className={`text-[10px] font-bold tabular-nums ${SCORE_COLOR[reviewLabel] ?? 'text-[var(--color-fonts-font-color-support)]'}`}>
                {reviewScore}
              </span>
            ) : null}
          </span>
        </TabButton>
      </TabBar>

      {/* ── Content tab — flex column so description fills remaining height ── */}
      {fieldTab === 'content' && (
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          <div className="shrink-0">
            <label className={labelClass}>Name / Summary</label>
            <Input
              value={proposal.proposedSummary ?? ''}
              onChange={(e) => onFieldChange(tabIdx, 'proposedSummary', e.target.value)}
              disabled={locked}
              className={`w-full text-xs ${highlightClass('proposedSummary')}`}
              placeholder="Issue title…"
            />
          </div>

          <div className="flex flex-col flex-1 min-h-0">
            <label className={labelClass}>Description</label>
            <div className="flex-1 min-h-0">
              <RichTextEditor
                value={proposal.proposedDescription ?? ''}
                onChange={(md) => onFieldChange(tabIdx, 'proposedDescription', md)}
                disabled={locked}
                fill
                highlight={tab.highlightedFields.has('proposedDescription')}
                placeholder="Describe the goal, context and expected outcome…"
              />
            </div>
          </div>

        </div>
      )}

      {/* ── Details tab — scrolls independently ─────────────────────────── */}
      {fieldTab === 'details' && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Label + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Label</label>
              <Input
                value={proposal.proposedLabel ?? ''}
                onChange={(e) => onFieldChange(tabIdx, 'proposedLabel', e.target.value)}
                disabled={locked}
                placeholder="e.g. my-feature"
                className={`w-full text-xs ${highlightClass('proposedLabel')}`}
              />
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <Select
                value={proposal.proposedPriority ?? ''}
                onChange={(v) => onFieldChange(tabIdx, 'proposedPriority', v)}
                options={PRIORITY_OPTIONS}
                disabled={locked}
                className={highlightClass('proposedPriority')}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Acceptance Criteria</label>
            <RichTextEditor
              value={proposal.proposedCriteria ?? ''}
              onChange={(md) => onFieldChange(tabIdx, 'proposedCriteria', md)}
              disabled={locked}
              minHeight={140}
              highlight={tab.highlightedFields.has('proposedCriteria')}
              placeholder="Given / When / Then…"
            />
          </div>

          <div>
            <label className={labelClass}>Technical Notes</label>
            <RichTextEditor
              value={proposal.proposedTechnical ?? ''}
              onChange={(md) => onFieldChange(tabIdx, 'proposedTechnical', md)}
              disabled={locked}
              minHeight={120}
              highlight={tab.highlightedFields.has('proposedTechnical')}
              placeholder="Implementation notes, tech stack, constraints…"
            />
          </div>
        </div>
      )}

      {/* ── Attachments tab ──────────────────────────────────────────────── */}
      {fieldTab === 'attachments' && (
        <AttachmentsTab scopeId={scopeId} issueKey={tab.issueKey} isNew={!!tab.isNew} />
      )}

      {/* ── Review tab ───────────────────────────────────────────────────── */}
      {fieldTab === 'review' && (
        <div className="flex-1 overflow-y-auto px-1">
          {isReviewing ? (
            <ReviewLoadingState prevScore={treeItem?.readinessScore} prevLabel={treeItem?.readinessLabel} />
          ) : treeItem && (treeItem.readinessScore != null || treeItem.readinessLabel) ? (
            <ReviewResult treeItem={treeItem} />
          ) : (
            <ReviewEmptyState />
          )}
        </div>
      )}
    </div>
  )
}
