import { useState, useRef } from 'react'
import { Upload, X, FileIcon, ImageIcon, AlertCircle } from 'lucide-react'
import type { ChatAttachment } from '@/types/api'

export interface AttachmentUploadProps {
  conversationId?: string
  onAttachmentUploaded?: (attachment: ChatAttachment) => void
  onRemoveAttachment?: (attachmentId: string) => void
  attachments?: ChatAttachment[]
  maxFileSize?: number // in bytes
  allowedTypes?: string[]
  disabled?: boolean
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024 // 10MB
const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'text/plain', 'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

export function AttachmentUpload({
  conversationId,
  onAttachmentUploaded,
  onRemoveAttachment,
  attachments = [],
  maxFileSize = DEFAULT_MAX_SIZE,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  disabled = false
}: AttachmentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (files: FileList) => {
    if (!conversationId) {
      setUploadError('No conversation ID provided')
      return
    }

    setUploadError(null)
    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        // Validate file size
        if (file.size > maxFileSize) {
          throw new Error(`File "${file.name}" exceeds maximum size of ${formatFileSize(maxFileSize)}`)
        }

        // Validate file type
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`File type "${file.type}" is not allowed`)
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
        onAttachmentUploaded?.(attachment)
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files)
    }
  }

  const handleRemoveAttachment = (attachmentId: string) => {
    onRemoveAttachment?.(attachmentId)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) {
      return <ImageIcon size={14} />
    }
    return <FileIcon size={14} />
  }

  return (
    <div className="space-y-2">
      {/* Upload button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--border-radius-button-small)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] hover:bg-[var(--color-cards-small-section-background)] text-[var(--color-fonts-font-color-primary)] text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Attach files"
      >
        <Upload size={14} />
        {uploading ? 'Uploading...' : 'Attach'}
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={allowedTypes.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Upload error */}
      {uploadError && (
        <div className="flex items-start gap-2 p-2 rounded-[var(--border-radius-card)] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <AlertCircle size={14} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-300">{uploadError}</p>
        </div>
      )}

      {/* Attached files list */}
      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((attachment) => (
            <div
              key={attachment.attachmentId}
              className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-cards-small-section-background)] border border-[var(--color-cards-card-stroke)]"
            >
              {getFileIcon(attachment.contentType)}
              <span className="text-xs text-[var(--color-fonts-font-color-primary)] truncate flex-1">
                {attachment.filename}
              </span>
              <span className="text-xs text-[var(--color-fonts-font-color-support)]">
                {formatFileSize(attachment.fileSize)}
              </span>
              <button
                onClick={() => handleRemoveAttachment(attachment.attachmentId)}
                className="p-0.5 rounded hover:bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-support)] hover:text-red-600 transition-colors"
                title="Remove attachment"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AttachmentUpload
