import { BaseContextDialog } from './BaseContextDialog'
import { CustomerContextItem } from '../../../types/api'
import { getToken } from '../../../lib/keycloak'
import { Building2, Hash } from 'lucide-react'

interface CustomerContextDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (customers: CustomerContextItem[]) => void
}

export function CustomerContextDialog({ isOpen, onClose, onSelect }: CustomerContextDialogProps) {
  const fetchCustomers = async (_query?: string): Promise<CustomerContextItem[]> => {
    // Note: Customer search is not query-based, returns all available customers
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/conversation-context/selection/customers`,
      {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      }
    )
    if (!response.ok) {
      throw new Error('Failed to fetch customers')
    }
    const data = await response.json()
    return data.customers || []
  }

  const renderCustomerItem = (customer: CustomerContextItem, isSelected: boolean, onToggle: () => void) => (
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
          <Building2 size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900 truncate">{customer.name}</h4>
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
              {customer.customerId}
            </span>
          </div>
          {customer.metadataSummary && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Hash size={14} />
              <span className="truncate">{customer.metadataSummary}</span>
            </div>
          )}
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
    <BaseContextDialog<CustomerContextItem>
      isOpen={isOpen}
      onClose={onClose}
      onSelect={onSelect}
      title="Select Customers"
      description="Choose customer configurations to add to the conversation context"
      fetchItems={fetchCustomers}
      renderItem={renderCustomerItem}
      getItemId={(customer) => customer.customerId}
      searchPlaceholder="Search customers..."
      emptyMessage="No customers found"
    />
  )
}
