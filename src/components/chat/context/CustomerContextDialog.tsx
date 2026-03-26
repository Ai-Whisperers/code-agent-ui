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
        p-3 rounded-[var(--border-radius-card)] border-2 cursor-pointer transition-colors
        ${isSelected
          ? 'border-[var(--color-buttons-button-primary)] bg-[var(--color-tags-success-background)]'
          : 'border-[var(--color-cards-card-stroke)] hover:border-[var(--color-inputs-input-border)] hover:bg-[var(--color-navigation-menu-item-hover-background)]'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`
          p-1.5 rounded-[var(--border-radius-small)] flex-shrink-0
          ${isSelected
            ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
            : 'bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-support)]'}
        `}>
          <Building2 size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-sm font-medium text-[var(--color-fonts-font-color-headings)] truncate">{customer.name}</h4>
            <span className="text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
              {customer.customerId}
            </span>
          </div>
          {customer.metadataSummary && (
            <div className="flex items-center gap-1 text-xs text-[var(--color-fonts-font-color-support)]">
              <Hash size={12} />
              <span className="truncate">{customer.metadataSummary}</span>
            </div>
          )}
        </div>
        {isSelected && (
          <div className="flex-shrink-0">
            <div className="w-4 h-4 bg-[var(--color-buttons-button-primary)] text-white rounded-full flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
