import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Send, Square, Plus, AlertCircle, X, MessageSquare, Lightbulb, FileText, Eye, Zap, Loader2, Building2, Package, Shield, Bug, Trash2 } from 'lucide-react'
import { detectSecrets } from './SecretScanner'
import { getToken } from '@/lib/keycloak'
import type { ChatAttachment, ExecutionPlan, CustomerContextItem, ProductContextItem, AikidoIssueContextItem, JiraIssueContextItem, ConfluenceDocContextItem, ConversationContext } from '@/types/api'
import { CustomerContextDialog } from './context/CustomerContextDialog'
import { ProductContextDialog } from './context/ProductContextDialog'
import { AikidoIssueContextDialog } from './context/AikidoIssueContextDialog'
import { JiraIssueContextDialog } from './context/JiraIssueContextDialog'
import { ConfluenceDocContextDialog } from './context/ConfluenceDocContextDialog'

export type ChatInputHandle = {
  clear: () => void
  focus: () => void
  setMode: (mode: ChatMode) => void
  clearContext: () => void
}

type ChatMode = 'ask' | 'plan'

type ChatInputBarProps = {
  isStreaming: boolean
  conversationId?: string
  onSend: (text: string, attachmentIds?: string[], mode?: ChatMode, conversationContext?: ConversationContext) => void
  onStop?: () => void
  onSecretWarning: (findings: string[], pendingText: string) => void
  onConversationCreate?: (conversationId: string) => void
  existingAttachments?: ChatAttachment[]
  existingContext?: ConversationContext
  activePlans?: ExecutionPlan[]
  isGeneratingPlan?: boolean
  generatingPlanTitle?: string
  onViewPlan?: (plan: ExecutionPlan) => void
  onImplementPlan?: (plan: ExecutionPlan) => void
  onDismissPlan?: (planId: string) => void
  canPlan?: boolean
  /** When true, hides the attachment/context (+) button and the mode-switcher button. */
  simplified?: boolean
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024 // 10MB
const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'text/plain', 'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

export const ChatInputBar = forwardRef<ChatInputHandle, ChatInputBarProps>(function ChatInputBar(
  { isStreaming, conversationId, onSend, onStop, onSecretWarning, onConversationCreate, existingAttachments = [], existingContext, activePlans = [], isGeneratingPlan = false, generatingPlanTitle = '', onViewPlan, onImplementPlan, onDismissPlan, canPlan = false, simplified = false },
  ref,
) {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [mode, setMode] = useState<ChatMode>('ask')
  const [showModeMenu, setShowModeMenu] = useState(false)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [conversationContext, setConversationContext] = useState<ConversationContext | null>(existingContext || null)
  const [showCustomerDialog, setShowCustomerDialog] = useState(false)
  const [showProductDialog, setShowProductDialog] = useState(false)
  const [showAikidoDialog, setShowAikidoDialog] = useState(false)
  const [showJiraDialog, setShowJiraDialog] = useState(false)
  const [showConfluenceDialog, setShowConfluenceDialog] = useState(false)
  const dragCounterRef = useRef(0)
  const pendingFindingsRef = useRef<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const secretDebounceRef = useRef<number | null>(null)
  const modeMenuRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Initialize attachments with existing attachments when they change.
  // Skip entirely in simplified mode — no attachments are supported there, and
  // the prop defaults to a new `[]` reference on every render which would cause
  // an infinite setState → re-render loop.
  useEffect(() => {
    if (simplified) return
    setAttachments(existingAttachments)
    // Fetch presigned URLs for existing image attachments
    existingAttachments.forEach(async (attachment) => {
      if (attachment.contentType.startsWith('image/')) {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL}/attachments/${attachment.attachmentId}/download`, {
            headers: { 'Authorization': `Bearer ${getToken()}` },
          })
          if (res.ok) {
            const data = await res.json()
            setPreviewUrls(prev => ({ ...prev, [attachment.attachmentId]: data.downloadUrl }))
          }
        } catch { /* silent */ }
      }
    })
  }, [simplified, existingAttachments])

  // Initialize context with existing context when it changes
  useEffect(() => {
    setConversationContext(existingContext || null)
  }, [existingContext])

  useImperativeHandle(ref, () => ({
    clear: () => {
      setInput('')
      setAttachments([])
      setUploadError(null)
      pendingFindingsRef.current = []
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    },
    focus: () => textareaRef.current?.focus(),
    setMode: (newMode: ChatMode) => setMode(newMode),
    clearContext: () => setConversationContext(null)
  }))

  useEffect(() => {
    if (secretDebounceRef.current) window.clearTimeout(secretDebounceRef.current)
    if (!input.trim()) {
      pendingFindingsRef.current = []
      return
    }
    secretDebounceRef.current = window.setTimeout(() => {
      pendingFindingsRef.current = detectSecrets(input)
    }, 300)
    return () => {
      if (secretDebounceRef.current) window.clearTimeout(secretDebounceRef.current)
    }
  }, [input])

  // Auto-hide menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setShowModeMenu(false)
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false)
      }
    }

    if (showModeMenu || showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModeMenu, showContextMenu])

  // Handle keyboard shortcut for mode switching (Cmd/Ctrl + .)
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '.') {
        event.preventDefault()
        if (canPlan) setMode(prevMode => prevMode === 'ask' ? 'plan' : 'ask')
      }
    }

    document.addEventListener('keydown', handleKeydown)

    return () => {
      document.removeEventListener('keydown', handleKeydown)
    }
  }, [])

  const handleSend = (text: string) => {
    if (!text.trim() || isStreaming) return
    
    // Check for mode switching commands
    const trimmedText = text.trim().toLowerCase()
    if (trimmedText === '.plan') {
      if (canPlan) setMode('plan')
      setInput('')
      return
    }
    if (trimmedText === '.ask') {
      setMode('ask')
      setInput('')
      return
    }
    
    // Check for secrets before sending
    const findings = pendingFindingsRef.current.length > 0 ? pendingFindingsRef.current : detectSecrets(text)
    if (findings.length > 0) {
      onSecretWarning(findings, text)
      return
    }

    const attachmentIds = attachments.length > 0 
      ? attachments.map(a => a.attachmentId) 
      : undefined

    onSend(text, attachmentIds, mode, conversationContext || undefined)
    setInput('')
    setAttachments([])
    setUploadError(null)
    pendingFindingsRef.current = []
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleAttachmentUploaded = (attachment: ChatAttachment) => {
    setAttachments(prev => [...prev, attachment])
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(a => a.attachmentId !== attachmentId))
    setPreviewUrls(prev => {
      const next = { ...prev }
      if (next[attachmentId]?.startsWith('blob:')) URL.revokeObjectURL(next[attachmentId])
      delete next[attachmentId]
      return next
    })
    setUploadError(null)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Context selection handlers
  const handleCustomerSelect = (customers: CustomerContextItem[]) => {
    const customerIds = customers.map(c => c.customerId)
    updateConversationContext({ customerIds })
  }

  const handleProductSelect = (products: ProductContextItem[]) => {
    const productIds = products.map(p => p.productId)
    updateConversationContext({ productIds })
  }

  const handleAikidoIssueSelect = (issues: AikidoIssueContextItem[]) => {
    const aikidoIssueIds = issues.map(i => i.issueGroupId)
    updateConversationContext({ aikidoIssueIds })
  }

  const handleJiraIssueSelect = (issues: JiraIssueContextItem[]) => {
    const jiraIssueKeys = issues.map(i => i.issueKey)
    updateConversationContext({ jiraIssueKeys })
  }

  const handleConfluenceDocSelect = (docs: ConfluenceDocContextItem[]) => {
    const confluenceDocIds = docs.map(d => d.pageId)
    updateConversationContext({ confluenceDocIds })
  }

  const persistContext = async (context: ConversationContext) => {
    if (!context.conversationId) return
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/conversation-context/${context.conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({
          customerIds: context.customerIds,
          productIds: context.productIds,
          aikidoIssueIds: context.aikidoIssueIds,
          jiraIssueKeys: context.jiraIssueKeys,
          confluenceDocIds: context.confluenceDocIds,
        }),
      })
    } catch { /* silent — UI state is source of truth */ }
  }

  const deleteContext = async (id: string) => {
    if (!id) return
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/conversation-context/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` },
      })
    } catch { /* silent */ }
  }

  const updateConversationContext = (updates: Partial<ConversationContext>) => {
    setConversationContext(prev => {
      const newContext = {
        conversationId: conversationId || '',
        customerIds: updates.customerIds || prev?.customerIds || [],
        productIds: updates.productIds || prev?.productIds || [],
        aikidoIssueIds: updates.aikidoIssueIds || prev?.aikidoIssueIds || [],
        jiraIssueKeys: updates.jiraIssueKeys || prev?.jiraIssueKeys || [],
        confluenceDocIds: updates.confluenceDocIds || prev?.confluenceDocIds || [],
        createdAt: prev?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      if (newContext.conversationId) persistContext(newContext)
      return newContext
    })
  }

  const removeContextItem = (type: string, id: string | number) => {
    setConversationContext(prev => {
      if (!prev) return null
      
      const updates: Partial<ConversationContext> = {}
      switch (type) {
        case 'customer':
          updates.customerIds = prev.customerIds.filter(cid => cid !== id)
          break
        case 'product':
          updates.productIds = prev.productIds.filter(pid => pid !== id)
          break
        case 'aikido':
          updates.aikidoIssueIds = prev.aikidoIssueIds.filter(aid => aid !== id)
          break
        case 'jira':
          updates.jiraIssueKeys = prev.jiraIssueKeys.filter(jid => jid !== id)
          break
        case 'confluence':
          updates.confluenceDocIds = prev.confluenceDocIds.filter(cid => cid !== id)
          break
      }
      
      const newContext = {
        ...prev,
        ...updates,
        updatedAt: new Date().toISOString()
      }
      if (newContext.conversationId) persistContext(newContext)
      return newContext
    })
  }

  const clearAllContext = () => {
    if (conversationId) deleteContext(conversationId)
    setConversationContext(null)
  }

  const getContextItemCount = () => {
    if (!conversationContext) return 0
    return (
      conversationContext.customerIds.length +
      conversationContext.productIds.length +
      conversationContext.aikidoIssueIds.length +
      conversationContext.jiraIssueKeys.length +
      conversationContext.confluenceDocIds.length
    )
  }

  const renderContextChips = () => {
    if (!conversationContext) return null
    
    const chips: React.ReactElement[] = []
    
    // Customer chips
    conversationContext.customerIds.forEach(id => {
      chips.push(
        <div
          key={`customer-${id}`}
          className="inline-flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1.5 max-w-[200px]"
        >
          <Building2 size={12} className="text-purple-600 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs text-purple-700 truncate font-medium">{id}</div>
            <div className="text-xs text-purple-500">Customer</div>
          </div>
          <button
            onClick={() => removeContextItem('customer', id)}
            className="p-0.5 rounded hover:bg-purple-100 text-purple-400 hover:text-purple-600 transition-colors shrink-0"
            title="Remove customer context"
          >
            <X size={10} />
          </button>
        </div>
      )
    })
    
    // Product chips
    conversationContext.productIds.forEach(id => {
      chips.push(
        <div
          key={`product-${id}`}
          className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5 max-w-[200px]"
        >
          <Package size={12} className="text-green-600 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs text-green-700 truncate font-medium">{id}</div>
            <div className="text-xs text-green-500">Product</div>
          </div>
          <button
            onClick={() => removeContextItem('product', id)}
            className="p-0.5 rounded hover:bg-green-100 text-green-400 hover:text-green-600 transition-colors shrink-0"
            title="Remove product context"
          >
            <X size={10} />
          </button>
        </div>
      )
    })
    
    // Aikido issue chips
    conversationContext.aikidoIssueIds.forEach(id => {
      chips.push(
        <div
          key={`aikido-${id}`}
          className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1.5 max-w-[200px]"
        >
          <Shield size={12} className="text-orange-600 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs text-orange-700 truncate font-medium">#{id}</div>
            <div className="text-xs text-orange-500">Aikido Issue</div>
          </div>
          <button
            onClick={() => removeContextItem('aikido', id)}
            className="p-0.5 rounded hover:bg-orange-100 text-orange-400 hover:text-orange-600 transition-colors shrink-0"
            title="Remove Aikido issue context"
          >
            <X size={10} />
          </button>
        </div>
      )
    })
    
    // Jira issue chips
    conversationContext.jiraIssueKeys.forEach(key => {
      chips.push(
        <div
          key={`jira-${key}`}
          className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 max-w-[200px]"
        >
          <Bug size={12} className="text-blue-600 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs text-blue-700 truncate font-medium">{key}</div>
            <div className="text-xs text-blue-500">Jira Issue</div>
          </div>
          <button
            onClick={() => removeContextItem('jira', key)}
            className="p-0.5 rounded hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors shrink-0"
            title="Remove Jira issue context"
          >
            <X size={10} />
          </button>
        </div>
      )
    })
    
    // Confluence doc chips
    conversationContext.confluenceDocIds.forEach(id => {
      chips.push(
        <div
          key={`confluence-${id}`}
          className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1.5 max-w-[200px]"
        >
          <FileText size={12} className="text-indigo-600 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs text-indigo-700 truncate font-medium">{id}</div>
            <div className="text-xs text-indigo-500">Confluence Doc</div>
          </div>
          <button
            onClick={() => removeContextItem('confluence', id)}
            className="p-0.5 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 transition-colors shrink-0"
            title="Remove Confluence doc context"
          >
            <X size={10} />
          </button>
        </div>
      )
    })
    
    return chips
  }

  const handleFileUpload = async (files: FileList) => {
    let currentConversationId = conversationId

    // Create conversation if one doesn't exist
    if (!currentConversationId) {
      currentConversationId = crypto.randomUUID()
      onConversationCreate?.(currentConversationId)
    }

    setUploadError(null)
    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        // Validate file size
        if (file.size > DEFAULT_MAX_SIZE) {
          throw new Error(`File "${file.name}" exceeds maximum size of ${formatFileSize(DEFAULT_MAX_SIZE)}`)
        }

        // Validate file type
        if (!DEFAULT_ALLOWED_TYPES.includes(file.type)) {
          throw new Error(`File type "${file.type}" is not supported`)
        }

        // Upload file
        const formData = new FormData()
        formData.append('file', file)
        formData.append('conversationId', currentConversationId)
        formData.append('filename', file.name)
        formData.append('contentType', file.type)
        formData.append('fileSize', file.size.toString())

        const response = await fetch(`${import.meta.env.VITE_API_URL}/attachments/upload`, {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${getToken()}`,
          },
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Upload failed')
        }

        const attachment: ChatAttachment = await response.json()
        handleAttachmentUploaded(attachment)
        // Create object URL preview for image attachments
        if (file.type.startsWith('image/')) {
          const objectUrl = URL.createObjectURL(file)
          setPreviewUrls(prev => ({ ...prev, [attachment.attachmentId]: objectUrl }))
        }
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileUpload(files)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
    }
  }

  const handleResizeTextarea = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div className="shrink-0 px-4 sm:px-8 py-4 bg-[var(--color-page-background)]">
      {/* Modern pill-shaped input container */}
      <div className="max-w-2xl mx-auto">

        {/* Plan attachment row - shown when plan is generating or active */}
        {(isGeneratingPlan || activePlans.length > 0) && (
          <div className="border border-b-0 border-[var(--color-cards-card-stroke)] rounded-t-xl bg-[var(--color-cards-card-background)] overflow-hidden">
            {isGeneratingPlan && (
              <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <FileText size={14} className="text-[var(--color-fonts-font-color-support)] shrink-0" />
                <span className="flex-1 truncate text-[var(--color-fonts-font-color-primary)] font-medium">
                  {generatingPlanTitle || 'Generating plan...'}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-[var(--color-fonts-font-color-support)] shrink-0">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Building...</span>
                </div>
              </div>
            )}
            {activePlans.map((plan) => (
              <div
                key={plan.planId}
                className="flex items-center gap-3 px-4 py-2.5 text-sm border-t border-[var(--color-cards-card-stroke)] first:border-t-0"
              >
                <FileText size={14} className="text-[var(--color-fonts-font-color-support)] shrink-0" />
                <span className="flex-1 truncate text-[var(--color-fonts-font-color-primary)] font-medium">
                  {plan.title}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onViewPlan?.(plan)}
                    className="px-2.5 py-1 rounded-md border border-[var(--color-cards-card-stroke)] text-xs font-medium text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-stroke)] transition-colors"
                  >
                    <Eye size={12} className="inline mr-1" />
                    View
                  </button>
                  {plan.status === 'DRAFT' && canPlan && (
                    <button
                      onClick={() => onImplementPlan?.(plan)}
                      className="px-2.5 py-1 rounded-md bg-[var(--color-buttons-button-primary)] text-white text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
                    >
                      <Zap size={12} />
                      Implement ⌘↵
                    </button>
                  )}
                  {(plan.status === 'EXECUTING' || plan.status === 'APPROVED') && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-[var(--color-fonts-font-color-support)]">
                      <Loader2 size={12} className="animate-spin" />
                      Executing...
                    </div>
                  )}
                  <button
                    onClick={() => onDismissPlan?.(plan.planId)}
                    className="p-1 rounded hover:bg-[var(--color-cards-card-stroke)] text-[var(--color-fonts-font-color-support)] transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`relative flex flex-col transition-colors ${isDragging ? 'ring-2 ring-blue-400 bg-blue-50' : ''} ${
          isGeneratingPlan || activePlans.length > 0
            ? mode === 'plan'
              ? 'border border-orange-200 rounded-b-xl bg-orange-50 focus-within:border-orange-400'
              : 'border border-[var(--color-cards-card-stroke)] rounded-b-xl bg-[var(--color-cards-card-background)]'
            : mode === 'plan'
              ? `${attachments.length > 0 || getContextItemCount() > 0 ? 'rounded-2xl' : 'rounded-full'} bg-orange-50 hover:bg-orange-100 border border-orange-200 hover:border-orange-300 focus-within:border-orange-400`
              : `${attachments.length > 0 || getContextItemCount() > 0 ? 'rounded-2xl' : 'rounded-full'} bg-gray-100 hover:bg-gray-50 border border-gray-200 hover:border-gray-300 focus-within:border-blue-500`
        }`}>

        {/* Inline attachments and context - shown at top of input container */}
        {(attachments.length > 0 || getContextItemCount() > 0) && (
          <div className="flex flex-wrap gap-2 p-3 pb-1">
            {attachments.map((attachment) => (
              <div
                key={attachment.attachmentId}
                className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5 max-w-[280px]"
              >
                {previewUrls[attachment.attachmentId] ? (
                  <img
                    src={previewUrls[attachment.attachmentId]}
                    alt={attachment.filename}
                    className="w-8 h-8 rounded object-cover shrink-0"
                  />
                ) : (
                  <FileText size={13} className="text-gray-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-xs text-gray-500 truncate">{attachment.filename}</div>
                  <div className="text-xs text-gray-400">{formatFileSize(attachment.fileSize)}</div>
                </div>
                <button
                  onClick={() => removeAttachment(attachment.attachmentId)}
                  className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                  title="Remove attachment"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {renderContextChips()}
          </div>
        )}

        {/* Clear context button - positioned top-right */}
        {getContextItemCount() > 0 && (
          <div className="absolute top-2 right-2 z-10">
            <button
              onClick={clearAllContext}
              className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-red-100 bg-white border border-red-200 hover:border-red-300 text-red-600 hover:text-red-700 transition-colors shadow-sm"
              title="Clear all context items"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 p-3">        
        {/* Context and attachment menu — hidden in simplified mode */}
        {!simplified && <div className="relative" ref={contextMenuRef}>
          <button
            onClick={() => setShowContextMenu(!showContextMenu)}
            disabled={isStreaming || uploading}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
            title={uploading ? 'Uploading...' : 'Add context or attachment'}
          >
            <Plus size={18} />
          </button>

          {/* Context/Attachment selection menu */}
          {showContextMenu && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px] z-10">
              <button
                onClick={() => {
                  const fileInput = document.createElement('input')
                  fileInput.type = 'file'
                  fileInput.multiple = true
                  fileInput.accept = DEFAULT_ALLOWED_TYPES.join(',')
                  fileInput.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files
                    if (files && files.length > 0) {
                      handleFileUpload(files)
                    }
                  }
                  fileInput.click()
                  setShowContextMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
              >
                <FileText size={14} />
                File Attachment
              </button>
              
              <div className="border-t border-gray-100 my-1"></div>
              
              <button
                onClick={() => {
                  setShowCustomerDialog(true)
                  setShowContextMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
              >
                <Building2 size={14} />
                Customer Context
              </button>
              
              <button
                onClick={() => {
                  setShowProductDialog(true)
                  setShowContextMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
              >
                <Package size={14} />
                Product Context
              </button>
              
              <button
                onClick={() => {
                  setShowAikidoDialog(true)
                  setShowContextMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
              >
                <Shield size={14} />
                Aikido Issues
              </button>
              
              <button
                onClick={() => {
                  setShowJiraDialog(true)
                  setShowContextMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
              >
                <Bug size={14} />
                Jira Issues
              </button>
              
              <button
                onClick={() => {
                  setShowConfluenceDialog(true)
                  setShowContextMenu(false)
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
              >
                <FileText size={14} />
                Confluence Docs
              </button>
            </div>
          )}
        </div>}

        {/* Mode switcher button — hidden in simplified mode */}
        {!simplified && <div className="relative" ref={modeMenuRef}>
          <button
            onClick={() => setShowModeMenu(!showModeMenu)}
            disabled={isStreaming}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === 'plan'
                ? 'hover:bg-orange-200 text-orange-600'
                : 'hover:bg-gray-200 text-gray-600'
            }`}
            title={`Current mode: ${mode === 'ask' ? 'Ask' : 'Plan'}`}
          >
            {mode === 'ask' ? <MessageSquare size={16} /> : <Lightbulb size={16} />}
          </button>

          {/* Mode selection menu */}
          {showModeMenu && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[100px] z-10">
              <button
                onClick={() => {
                  setMode('ask')
                  setShowModeMenu(false)
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  mode === 'ask' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <MessageSquare size={14} />
                Ask
              </button>
              {canPlan && (
                <button
                  onClick={() => {
                    setMode('plan')
                    setShowModeMenu(false)
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                    mode === 'plan' ? 'bg-orange-50 text-orange-700' : 'text-gray-700'
                  }`}
                >
                  <Lightbulb size={14} />
                  Plan
                </button>
              )}
            </div>
          )}
        </div>}

        {/* Input field */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleResizeTextarea}
          placeholder={
            isStreaming
              ? 'Waiting for response…'
              : mode === 'ask' ? 'Ask anything… (Enter to send, Shift+Enter for newline)' : 'Describe what you want to plan (Enter to send, Shift+Enter for newline)'
          }
          disabled={isStreaming}
          rows={1}
          className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-gray-900 placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ maxHeight: '120px', overflowY: 'auto' }}
        />

        {/* Send / Stop button */}
        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-black hover:bg-gray-800 transition-colors text-white"
            title="Stop generation"
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim()}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 transition-colors text-white"
            title="Send message"
          >
            <Send size={16} />
          </button>
        )}
        </div>
        </div>
      </div>
      
      {/* Upload error display */}
      {uploadError && (
        <div className="max-w-2xl mx-auto mt-2 px-4 sm:px-0">
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle size={14} className="text-red-600 shrink-0" />
            <p className="text-xs text-red-700 flex-1">{uploadError}</p>
            <button
              onClick={() => setUploadError(null)}
              className="ml-2 p-0.5 rounded hover:bg-red-100 text-red-600 transition-colors shrink-0"
              title="Dismiss error"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
      
      {!simplified && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          Responses may include Markdown, Mermaid diagrams, Chart.js charts, and
          syntax-highlighted code.
        </p>
      )}


      {/* Context Selection Dialogs */}
      <CustomerContextDialog
        isOpen={showCustomerDialog}
        onClose={() => setShowCustomerDialog(false)}
        onSelect={handleCustomerSelect}
      />
      
      <ProductContextDialog
        isOpen={showProductDialog}
        onClose={() => setShowProductDialog(false)}
        onSelect={handleProductSelect}
      />
      
      <AikidoIssueContextDialog
        isOpen={showAikidoDialog}
        onClose={() => setShowAikidoDialog(false)}
        onSelect={handleAikidoIssueSelect}
      />
      
      <JiraIssueContextDialog
        isOpen={showJiraDialog}
        onClose={() => setShowJiraDialog(false)}
        onSelect={handleJiraIssueSelect}
      />
      
      <ConfluenceDocContextDialog
        isOpen={showConfluenceDialog}
        onClose={() => setShowConfluenceDialog(false)}
        onSelect={handleConfluenceDocSelect}
      />
    </div>
  )
})
