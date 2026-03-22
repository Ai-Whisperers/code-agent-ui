import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Send, Plus, AlertCircle, X } from 'lucide-react'
import { detectSecrets } from './SecretScanner'
import { AttachmentUpload } from './AttachmentUpload'
import type { ChatAttachment } from '@/types/api'

export type ChatInputHandle = {
  clear: () => void
  focus: () => void
}

type ChatInputBarProps = {
  isStreaming: boolean
  conversationId?: string
  onSend: (text: string, attachmentIds?: string[]) => void
  onSecretWarning: (findings: string[], pendingText: string) => void
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024 // 10MB
const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'text/plain', 'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

export const ChatInputBar = forwardRef<ChatInputHandle, ChatInputBarProps>(function ChatInputBar(
  { isStreaming, conversationId, onSend, onSecretWarning },
  ref,
) {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const pendingFindingsRef = useRef<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const secretDebounceRef = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({
    clear: () => {
      setInput('')
      setAttachments([])
      setUploadError(null)
      pendingFindingsRef.current = []
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    },
    focus: () => textareaRef.current?.focus(),
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

  const handleSend = (text: string) => {
    if (!text.trim() || isStreaming) return
    const findings = pendingFindingsRef.current.length > 0 ? pendingFindingsRef.current : detectSecrets(text)
    if (findings.length > 0) {
      onSecretWarning(findings, text)
      return
    }
    
    const attachmentIds = attachments.length > 0 ? attachments.map(a => a.attachmentId) : undefined
    onSend(text, attachmentIds)
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
        <div className="flex items-center gap-2 p-3 rounded-full bg-gray-100 hover:bg-gray-50 transition-colors border border-gray-200 hover:border-gray-300 focus-within:border-blue-500">
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
              : 'Ask anything… (Enter to send, Shift+Enter for newline)'
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
