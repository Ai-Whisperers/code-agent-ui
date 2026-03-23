import { BaseContextDialog } from './BaseContextDialog'
import { AikidoIssueContextItem } from '../../../types/api'
import { getToken } from '../../../lib/keycloak'
import { Shield, AlertTriangle, Package, GitBranch } from 'lucide-react'

interface AikidoIssueContextDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (issues: AikidoIssueContextItem[]) => void
  repoSlug?: string
}

export function AikidoIssueContextDialog({ isOpen, onClose, onSelect, repoSlug }: AikidoIssueContextDialogProps) {
  const fetchAikidoIssues = async (_query?: string): Promise<AikidoIssueContextItem[]> => {
    const params = new URLSearchParams()
    if (repoSlug) {
      params.append('repoSlug', repoSlug)
    }
    // Note: Aikido search doesn't support text queries currently, only repo-based filtering
    
    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/conversation-context/selection/aikido-issues?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
      }
    )
    if (!response.ok) {
      throw new Error('Failed to fetch Aikido issues')
    }
    const data = await response.json()
    return data.aikidoIssues || []
  }

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const renderAikidoIssueItem = (issue: AikidoIssueContextItem, isSelected: boolean, onToggle: () => void) => (
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
          <Shield size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-gray-900 truncate">
              {issue.issueType || 'Security Issue'}
            </h4>
            <span className={`
              text-xs px-2 py-1 rounded border font-medium
              ${getSeverityColor(issue.severity)}
            `}>
              {issue.severity}
            </span>
          </div>
          
          <div className="space-y-1">
            {issue.packageName && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Package size={14} />
                <span className="truncate">{issue.packageName}</span>
              </div>
            )}
            
            {issue.cveId && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <AlertTriangle size={14} />
                <span className="font-mono text-xs">{issue.cveId}</span>
              </div>
            )}
            
            {issue.repoName && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <GitBranch size={14} />
                <span className="truncate">{issue.repoName}</span>
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
    <BaseContextDialog<AikidoIssueContextItem>
      isOpen={isOpen}
      onClose={onClose}
      onSelect={onSelect}
      title="Select Aikido Security Issues"
      description="Choose security vulnerabilities to add to the conversation context"
      fetchItems={fetchAikidoIssues}
      renderItem={renderAikidoIssueItem}
      getItemId={(issue) => issue.issueGroupId.toString()}
      searchPlaceholder="Search security issues..."
      emptyMessage="No security issues found"
    />
  )
}
