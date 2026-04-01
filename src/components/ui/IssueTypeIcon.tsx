import { Layers, Package, User } from 'lucide-react'
import { Tooltip } from './Tooltip'

export const ISSUE_TYPE_LABEL: Record<string, string> = {
  EPIC:      'Epic',
  FEATURE:   'Feature',
  USERSTORY: 'Story',
}

const ISSUE_TYPE_CONFIG: Record<string, { icon: React.ElementType; className: string }> = {
  EPIC:      { icon: Layers,  className: 'text-violet-500 dark:text-violet-400' },
  FEATURE:   { icon: Package, className: 'text-blue-500   dark:text-blue-400'   },
  USERSTORY: { icon: User,    className: 'text-emerald-500 dark:text-emerald-400' },
}

interface IssueTypeIconProps {
  issueType: string
  size?: number
  /** Show a tooltip with the human-readable type label (default true). */
  showTooltip?: boolean
}

export function IssueTypeIcon({ issueType, size = 13, showTooltip = true }: IssueTypeIconProps) {
  const config = ISSUE_TYPE_CONFIG[issueType]
  if (!config) return null

  const Icon = config.icon
  const icon = <Icon size={size} className={config.className} />

  return showTooltip ? (
    <Tooltip text={ISSUE_TYPE_LABEL[issueType] ?? issueType}>{icon}</Tooltip>
  ) : (
    icon
  )
}
