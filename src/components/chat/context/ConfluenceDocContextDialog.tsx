import { BaseContextDialog } from './BaseContextDialog'
import { ConfluenceDocContextItem } from '../../../types/api'
import { getToken } from '../../../lib/keycloak'
import { FileText, Folder, Eye } from 'lucide-react'

interface ConfluenceDocContextDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (docs: ConfluenceDocContextItem[]) => void
  productId?: string
}

export function ConfluenceDocContextDialog({ isOpen, onClose, onSelect, productId }: ConfluenceDocContextDialogProps) {
  const fetchConfluenceDocs = async (query?: string): Promise<ConfluenceDocContextItem[]> => {
    const params = new URLSearchParams()
    if (query) {
      params.append('query', query)
    }
    if (productId) {
      params.append('productId', productId)
    }
    
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/conversation-context/selection/confluence-docs?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      }
    )
    if (!response.ok) {
      throw new Error('Failed to fetch Confluence documents')
    }
    const data = await response.json()
    return data.confluenceDocs || []
  }

  const renderConfluenceDocItem = (doc: ConfluenceDocContextItem, isSelected: boolean, onToggle: () => void) => (
    <div
      onClick={onToggle}
      className={`
        p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-sm
        ${isSelected 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-300'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`
          p-2 rounded-lg flex-shrink-0
          ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
        `}>
          <FileText size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900 line-clamp-2">
              {doc.title}
            </h4>
          </div>
          
          <div className="space-y-1">
            {doc.spaceKey && doc.spaceName && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Folder size={14} />
                <span className="truncate">{doc.spaceName}</span>
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded font-mono">
                  {doc.spaceKey}
                </span>
              </div>
            )}
            
            {doc.contentPreview && (
              <div className="flex items-start gap-1 text-sm text-gray-600">
                <Eye size={14} className="mt-0.5 flex-shrink-0" />
                <p className="line-clamp-2 text-xs">{doc.contentPreview}</p>
              </div>
            )}
          </div>
        </div>
        {isSelected && (
          <div className="flex-shrink-0">
            <div className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <BaseContextDialog<ConfluenceDocContextItem>
      isOpen={isOpen}
      onClose={onClose}
      onSelect={onSelect}
      title="Select Confluence Documents"
      description="Choose Confluence pages to add to the conversation context"
      fetchItems={fetchConfluenceDocs}
      renderItem={renderConfluenceDocItem}
      getItemId={(doc) => doc.pageId}
      searchPlaceholder="Search documents..."
      emptyMessage="No Confluence documents found"
    />
  )
}
