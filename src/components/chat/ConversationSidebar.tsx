import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  MessageSquare,
} from 'lucide-react'
import type { ConversationSummary } from '@/types/api'
import api from '@/lib/api'
import { CONV_LS_KEY, groupConversations } from './conversationUtils'

export function ConversationSidebar({
  activeId,
  onSelect,
  onNewChat,
}: {
  activeId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
}) {
  const queryClient = useQueryClient()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: conversations = [], isLoading } = useQuery<ConversationSummary[]>({
    queryKey: ['conversations'],
    queryFn: () => api.get('/conversations').then((r) => r.data),
  })

  const groups = groupConversations(conversations)

  const startRename = (conv: ConversationSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingId(conv.conversationId)
    setRenameValue(conv.title)
  }

  const commitRename = async (id: string) => {
    const title = renameValue.trim()
    if (!title) {
      setRenamingId(null)
      return
    }
    try {
      await api.patch(`/conversations/${id}/title`, { title })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } finally {
      setRenamingId(null)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await api.delete(`/conversations/${id}`)
      localStorage.removeItem(CONV_LS_KEY(id))
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* New chat */}
      <div className="shrink-0 p-3 border-b border-[var(--color-cards-card-stroke)]">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-[var(--border-radius-button-small)] border border-[var(--color-cards-card-stroke)] hover:bg-[var(--color-cards-card-background)] text-sm text-[var(--color-fonts-font-color-primary)] transition-colors"
        >
          <Plus size={14} />
          New chat
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {isLoading && (
          <p className="px-4 py-4 text-xs text-center text-[var(--color-fonts-font-color-support)]">
            Loading…
          </p>
        )}
        {!isLoading && conversations.length === 0 && (
          <div className="px-4 py-10 flex flex-col items-center gap-2 text-center">
            <MessageSquare
              size={22}
              className="text-[var(--color-fonts-font-color-support)] opacity-30"
            />
            <p className="text-xs text-[var(--color-fonts-font-color-support)]">
              No conversations yet
            </p>
          </div>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pt-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)] opacity-50 select-none">
              {group.label}
            </p>
            {group.items.map((conv) => {
              const isActive = activeId === conv.conversationId
              const isRenaming = renamingId === conv.conversationId
              const isDeleting = deletingId === conv.conversationId

              return (
                <div
                  key={conv.conversationId}
                  onClick={() => !isRenaming && onSelect(conv.conversationId)}
                  className={`group relative flex items-center gap-2 mx-1.5 px-2.5 py-2 rounded-[var(--border-radius-button-small)] cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-[var(--color-buttons-button-primary)] text-white'
                      : 'hover:bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)]'
                  } ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  {isRenaming ? (
                    <div
                      className="flex-1 flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(conv.conversationId)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        onBlur={() => commitRename(conv.conversationId)}
                        className="flex-1 min-w-0 bg-transparent border-b border-current text-sm outline-none"
                      />
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault()
                          commitRename(conv.conversationId)
                        }}
                        className="shrink-0 opacity-80 hover:opacity-100"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setRenamingId(null)
                        }}
                        className="shrink-0 opacity-80 hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 text-sm truncate">{conv.title}</span>
                      <div
                        className={`shrink-0 hidden group-hover:flex items-center gap-0.5 ${isActive ? 'text-white/70' : 'text-[var(--color-fonts-font-color-support)]'}`}
                      >
                        <button
                          onClick={(e) => startRename(conv, e)}
                          className="p-0.5 rounded hover:opacity-100 opacity-60 transition-opacity"
                          title="Rename"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(conv.conversationId, e)}
                          className={`p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity ${isActive ? 'hover:text-red-300' : 'hover:text-red-500'}`}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
