import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Search, Loader2 } from 'lucide-react'

export interface BaseContextDialogProps<T> {
  isOpen: boolean
  onClose: () => void
  onSelect: (items: T[]) => void
  title: string
  description?: string
  fetchItems: (query?: string) => Promise<T[]>
  renderItem: (item: T, isSelected: boolean, onToggle: () => void) => React.ReactNode
  getItemId: (item: T) => string
  searchPlaceholder?: string
  emptyMessage?: string
}

export function BaseContextDialog<T>({
  isOpen,
  onClose,
  onSelect,
  title,
  description,
  fetchItems,
  renderItem,
  getItemId,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No items found'
}: BaseContextDialogProps<T>) {
  const [items, setItems] = useState<T[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const loadItems = useCallback(async (query?: string) => {
    setLoading(true)
    setError(null)
    try {
      const fetchedItems = await fetchItems(query)
      setItems(fetchedItems)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [fetchItems])

  useEffect(() => {
    if (isOpen) {
      loadItems(undefined)
    }
  }, [isOpen, loadItems])

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (isOpen) {
        loadItems(searchQuery.trim() || undefined)
      }
    }, 300) // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, isOpen, loadItems])

  const handleToggleItem = (item: T) => {
    const id = getItemId(item)
    const newSelected = new Set(selectedItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedItems(newSelected)
  }

  const handleAddSelected = () => {
    const selectedItemsList = items.filter(item => selectedItems.has(getItemId(item)))
    onSelect(selectedItemsList)
    handleClose()
  }

  const handleClose = () => {
    setSelectedItems(new Set())
    setSearchQuery('')
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {description && (
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Loading...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-red-600 font-medium">Error loading items</p>
                <p className="text-red-500 text-sm mt-1">{error}</p>
                <button
                  onClick={() => loadItems(undefined)}
                  className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">{emptyMessage}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item: T, index: number) => {
                const id = getItemId(item)
                const isSelected = selectedItems.has(id)
                return (
                  <div key={id || index}>
                    {renderItem(item, isSelected, () => handleToggleItem(item))}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelected}
              disabled={selectedItems.size === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add Selected ({selectedItems.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
