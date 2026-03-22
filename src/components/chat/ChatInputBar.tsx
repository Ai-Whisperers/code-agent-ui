import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Send, Plus, AlertCircle, X, MessageSquare, Lightbulb, FileText, Eye, Zap, Loader2 } from 'lucide-react'
import { detectSecrets } from './SecretScanner'
import { AttachmentUpload } from './AttachmentUpload'
import type { ChatAttachment, ExecutionPlan } from '@/types/api'

export type ChatInputHandle = {
  clear: () => void
  focus: () => void
  setMode: (mode: ChatMode) => void
}

type ChatMode = 'ask' | 'plan'

type ChatInputBarProps = {
  isStreaming: boolean
  conversationId?: string
  onSend: (text: string, attachmentIds?: string[], mode?: ChatMode) => void
  onSecretWarning: (findings: string[], pendingText: string) => void
  activePlans?: ExecutionPlan[]
  isGeneratingPlan?: boolean
  generatingPlanTitle?: string
  onViewPlan?: (plan: ExecutionPlan) => void
  onImplementPlan?: (plan: ExecutionPlan) => void
  onDismissPlan?: (planId: string) => void
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024 // 10MB
const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'text/plain', 'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

export const ChatInputBar = forwardRef<ChatInputHandle, ChatInputBarProps>(function ChatInputBar(
  { isStreaming, conversationId, onSend, onSecretWarning, activePlans = [], isGeneratingPlan = false, generatingPlanTitle = '', onViewPlan, onImplementPlan, onDismissPlan },
  ref,
) {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState<ChatMode>('ask')
  const [showModeMenu, setShowModeMenu] = useState(false)
  const pendingFindingsRef = useRef<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const secretDebounceRef = useRef<number | null>(null)
  const modeMenuRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    clear: () => {
      setInput('')
      setAttachments([])
      setUploadError(null)
      pendingFindingsRef.current = []
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    },
    focus: () => textareaRef.current?.focus(),
    setMode: (m: ChatMode) => setMode(m),
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

  // Close mode menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setShowModeMenu(false)
      }
    }

    if (showModeMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModeMenu])

  // Handle keyboard shortcut for mode switching (Cmd/Ctrl + .)
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '.') {
        event.preventDefault()
        setMode(prevMode => prevMode === 'ask' ? 'plan' : 'ask')
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
      setMode('plan')
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

    onSend(text, attachmentIds, mode)
    setInput('')
    setAttachments([])
    setUploadError(null)
    pendingFindingsRef.current = []
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleAttachmentUploaded = (attachment: ChatAttachment) => {
    setAttachments(prev => [...prev, attachment])
  }

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(a => a.attachmentId !== attachmentId))
    setUploadError(null)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleFileUpload = async (files: FileList) => {
    if (!conversationId) {
      setUploadError('No conversation available for file upload')
      return
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
        formData.append('conversationId', conversationId)
        formData.append('filename', file.name)
        formData.append('contentType', file.type)
        formData.append('fileSize', file.size.toString())

        const response = await fetch(`${import.meta.env.VITE_API_URL}/attachments/upload`, {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Upload failed')
        }

        const attachment: ChatAttachment = await response.json()
        handleAttachmentUploaded(attachment)
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
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
      {/* Attachment upload section - show above input when active */}
      {conversationId && attachments.length > 0 && (
        <div className="mb-3">
          <AttachmentUpload
            conversationId={conversationId}
            onAttachmentUploaded={handleAttachmentUploaded}
            onRemoveAttachment={handleRemoveAttachment}
            attachments={attachments}
            disabled={isStreaming}
          />
        </div>
      )}
      
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
                  {plan.status === 'DRAFT' && (
                    <button
                      onClick={() => onImplementPlan?.(plan)}
                      className="px-2.5 py-1 rounded-md bg-[var(--color-buttons-button-primary)] text-white text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1"
                    >
                      <Zap size={12} />
                      Implement ⌘↵
                    </button>
                  )}
                  {(plan.status === 'RUNNING' || plan.status === 'APPROVED') && (
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

        <div className={`flex items-center gap-2 p-3 transition-colors ${
          isGeneratingPlan || activePlans.length > 0
            ? mode === 'plan'
              ? 'border border-orange-200 rounded-b-xl bg-orange-50 focus-within:border-orange-400'
              : 'border border-[var(--color-cards-card-stroke)] rounded-b-xl bg-[var(--color-cards-card-background)]'
            : mode === 'plan'
              ? 'rounded-full bg-orange-50 hover:bg-orange-100 border border-orange-200 hover:border-orange-300 focus-within:border-orange-400'
              : 'rounded-full bg-gray-100 hover:bg-gray-50 border border-gray-200 hover:border-gray-300 focus-within:border-blue-500'
        }`}>
        {/* Plus icon for attachments/options */}
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
          }}
          disabled={isStreaming || uploading}
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
          title={uploading ? 'Uploading...' : 'Add attachment'}
        >
          <Plus size={18} />
        </button>

        {/* Mode switcher button */}
        <div className="relative" ref={modeMenuRef}>
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
            </div>
          )}
        </div>

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

        {/* Send button */}
        <button
          onClick={() => handleSend(input)}
          disabled={!input.trim() || isStreaming}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 transition-colors text-white"
          title="Send message"
        >
          <Send size={16} />
        </button>
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
      
      <p className="text-xs text-gray-500 mt-2 text-center">
        Responses may include Markdown, Mermaid diagrams, Chart.js charts, and
        syntax-highlighted code.
      </p>
    </div>
  )
})
