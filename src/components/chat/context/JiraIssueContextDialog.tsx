import { useCallback } from 'react'
import { BaseContextDialog } from './BaseContextDialog'
import { JiraIssueContextItem } from '../../../types/api'
import { getToken } from '../../../lib/keycloak'
import { CheckCircle, Clock, AlertCircle, Bug } from 'lucide-react'

interface JiraIssueContextDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (issues: JiraIssueContextItem[]) => void
  productId?: string
}

export function JiraIssueContextDialog({ isOpen, onClose, onSelect, productId }: JiraIssueContextDialogProps) {

  const fetchJiraIssues = useCallback(async (query?: string): Promise<JiraIssueContextItem[]> => {
    const params = new URLSearchParams()
    if (query) {
      params.append('query', query)
    }
    if (productId) {
      params.append('productId', productId)
    }
    
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/conversation-context/selection/jira-issues?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      }
    )
    if (!response.ok) {
      throw new Error('Failed to fetch Jira issues')
    }
    const data = await response.json()
    return data.jiraIssues || []
  }, [productId])

  // Remove broken filtering for now

  const getStatusIcon = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'done': case 'closed': case 'resolved':
        return <CheckCircle size={14} className="text-green-600" />
      case 'in progress': case 'in review':
        return <Clock size={14} className="text-blue-600" />
      case 'blocked':
        return <AlertCircle size={14} className="text-red-600" />
      default:
        return <Bug size={14} className="text-gray-600" />
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'done': case 'closed': case 'resolved':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'in progress': case 'in review':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'blocked':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const renderJiraIssueItem = (issue: JiraIssueContextItem, isSelected: boolean, onToggle: () => void) => (
    <div
      onClick={onToggle}
      className={`
        p-2 rounded-lg border cursor-pointer transition-all hover:shadow-sm
        ${isSelected 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-300'
        }
      `}
    >
      <div className="flex items-center gap-2">
        <div className={`
          p-1 rounded flex-shrink-0
          ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
        `}>
          {getStatusIcon(issue.status)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-medium text-blue-600">
              {issue.issueKey}
            </span>
            {issue.status && (
              <span className={`
                text-xs px-1.5 py-0.5 rounded border font-medium
                ${getStatusColor(issue.status)}
              `}>
                {issue.status}
              </span>
            )}
            {issue.issueType && (
              <span className="text-xs text-gray-500 capitalize">
                {issue.issueType}
              </span>
            )}
            {issue.assignee && (
              <span className="text-xs text-gray-500">
                👤 {issue.assignee}
              </span>
            )}
          </div>
          
          <h4 className="text-sm font-medium text-gray-900 line-clamp-1">
            {issue.summary}
          </h4>
        </div>
        {isSelected && (
          <div className="flex-shrink-0">
            <div className="w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <BaseContextDialog<JiraIssueContextItem>
      isOpen={isOpen}
      onClose={onClose}
      onSelect={onSelect}
      title="Select Jira Issues"
      description="Choose Jira issues to add to the conversation context"
      fetchItems={fetchJiraIssues}
      renderItem={renderJiraIssueItem}
      getItemId={(issue) => issue.issueKey}
      searchPlaceholder="Search issues..."
      emptyMessage="No Jira issues found"
    />
  )
}
