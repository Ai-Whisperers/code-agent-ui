import {
  LayoutDashboard,
  Wrench,
  Settings,
  GitBranch,
  BarChart3,
  MessageSquare,
  ChevronDown,
  BookOpen,
  ClipboardList,
  FolderGit2,
  Zap,
  FileText,
  Brain,
  Users,
  Sliders,
  ShieldCheck,
  GitPullRequest,
  BotMessageSquare,
  ScrollText,
  MapPin,
} from 'lucide-react'
import type { Permission } from '@/lib/permissions'

export interface NavigationMenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  path?: string
  onClick?: () => void
  isActive?: boolean
  children?: NavigationMenuItem[]
  type?: 'item' | 'section' | 'parent'
  sectionLabel?: string
  /** When set, item is hidden unless the user has this permission */
  requiredPermission?: Permission
}

export function ApplicationMenuItems(
  navigate: (opts: { to: string }) => void,
  currentPath: string,
  permissions: Set<Permission>,
  onNavigate?: () => void,
): NavigationMenuItem[] {
  const go = (to: string) => {
    navigate({ to })
    onNavigate?.()
  }

  const allItems: NavigationMenuItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard size={18} />,
      path: '/',
      isActive: currentPath === '/',
      type: 'item',
      onClick: () => go('/'),
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: <MessageSquare size={18} />,
      path: '/chat',
      isActive: currentPath === '/chat',
      type: 'item',
      onClick: () => go('/chat'),
    },
    {
      id: 'jobs',
      label: 'Jobs',
      icon: <Wrench size={18} />,
      path: '/jobs',
      isActive: currentPath.startsWith('/jobs'),
      type: 'item',
      onClick: () => go('/jobs'),
    },
    {
      id: 'plans',
      label: 'Plans',
      icon: <GitBranch size={18} />,
      path: '/plans',
      isActive: currentPath.startsWith('/plans'),
      type: 'item',
      onClick: () => go('/plans'),
    },
    {
      id: 'metrics-section',
      label: 'Metrics',
      type: 'parent',
      icon: <BarChart3 size={18} />,
      isActive: currentPath.startsWith('/metrics') || currentPath.startsWith('/stats') || currentPath.startsWith('/metrics/roadmap'),
      children: [
        {
          id: 'quality-reports',
          label: 'Quality Reports',
          icon: <ShieldCheck size={16} />,
          path: '/metrics/quality',
          isActive: currentPath === '/metrics/quality',
          type: 'item',
          onClick: () => go('/metrics/quality'),
        },
        {
          id: 'review-metrics',
          label: 'Review Metrics',
          icon: <GitPullRequest size={16} />,
          path: '/metrics/reviews',
          isActive: currentPath === '/metrics/reviews',
          type: 'item',
          onClick: () => go('/metrics/reviews'),
        },
        {
          id: 'developer-scorecard',
          label: 'Developer Scorecard',
          icon: <Users size={16} />,
          path: '/metrics/developers',
          isActive: currentPath === '/metrics/developers',
          type: 'item',
          onClick: () => go('/metrics/developers'),
        },
        {
          id: 'ai-stats',
          label: 'AI Stats',
          icon: <BotMessageSquare size={16} />,
          path: '/stats',
          isActive: currentPath === '/stats',
          type: 'item',
          onClick: () => go('/stats'),
        },
        {
          id: 'roadmap',
          label: 'Roadmap',
          icon: <MapPin size={16} />,
          path: '/metrics/roadmap',
          isActive: currentPath.startsWith('/metrics/roadmap'),
          type: 'item',
          requiredPermission: 'VIEW_ROADMAP',
          onClick: () => go('/metrics/roadmap'),
        },
      ],
    },
    {
      id: 'settings-section',
      label: 'Settings',
      type: 'parent',
      icon: <Settings size={18} />,
      isActive: currentPath.startsWith('/settings'),
      requiredPermission: 'MANAGE_SETTINGS',
      children: [
        {
          id: 'repos',
          label: 'Repositories',
          icon: <FolderGit2 size={16} />,
          path: '/settings/repos',
          isActive: currentPath === '/settings/repos',
          type: 'item',
          requiredPermission: 'MANAGE_SETTINGS',
          onClick: () => go('/settings/repos'),
        },
        {
          id: 'hooks',
          label: 'Hooks',
          icon: <Zap size={16} />,
          path: '/settings/hooks',
          isActive: currentPath === '/settings/hooks',
          type: 'item',
          requiredPermission: 'MANAGE_SETTINGS',
          onClick: () => go('/settings/hooks'),
        },
        {
          id: 'prompts',
          label: 'Prompts',
          icon: <FileText size={16} />,
          path: '/settings/prompts',
          isActive: currentPath === '/settings/prompts',
          type: 'item',
          requiredPermission: 'MANAGE_SETTINGS',
          onClick: () => go('/settings/prompts'),
        },
        {
          id: 'memories',
          label: 'Memories',
          icon: <Brain size={16} />,
          path: '/settings/memories',
          isActive: currentPath === '/settings/memories',
          type: 'item',
          requiredPermission: 'MANAGE_SETTINGS',
          onClick: () => go('/settings/memories'),
        },
        {
          id: 'customers',
          label: 'Customers',
          icon: <Users size={16} />,
          path: '/settings/customers',
          isActive: currentPath === '/settings/customers',
          type: 'item',
          requiredPermission: 'MANAGE_SETTINGS',
          onClick: () => go('/settings/customers'),
        },
        {
          id: 'knowledge-index',
          label: 'Knowledge Index',
          icon: <BookOpen size={16} />,
          path: '/settings/knowledge',
          isActive: currentPath === '/settings/knowledge',
          type: 'item',
          requiredPermission: 'MANAGE_SETTINGS',
          onClick: () => go('/settings/knowledge'),
        },
        {
          id: 'webhook-audit',
          label: 'Webhook Audit',
          icon: <ScrollText size={16} />,
          path: '/settings/webhook-audit',
          isActive: currentPath === '/settings/webhook-audit',
          type: 'item',
          requiredPermission: 'MANAGE_SETTINGS',
          onClick: () => go('/settings/webhook-audit'),
        },
        {
          id: 'audit-log',
          label: 'Audit Log',
          icon: <ClipboardList size={16} />,
          path: '/settings/audit',
          isActive: currentPath === '/settings/audit',
          type: 'item',
          requiredPermission: 'MANAGE_SETTINGS',
          onClick: () => go('/settings/audit'),
        },
        {
          id: 'system-settings',
          label: 'System',
          icon: <Sliders size={16} />,
          path: '/settings/system',
          isActive: currentPath === '/settings/system',
          type: 'item',
          requiredPermission: 'MANAGE_SETTINGS',
          onClick: () => go('/settings/system'),
        },
      ],
    },
  ]

  return filterByPermissions(allItems, permissions)
}

/**
 * Recursively filters menu items by the user's permission set.
 * A parent item is hidden when all of its children are hidden.
 */
function filterByPermissions(
  items: NavigationMenuItem[],
  permissions: Set<Permission>,
): NavigationMenuItem[] {
  const filtered: NavigationMenuItem[] = []

  for (const item of items) {
    if (item.requiredPermission && !permissions.has(item.requiredPermission)) {
      continue
    }

    if (item.children && item.children.length > 0) {
      const visibleChildren = filterByPermissions(item.children, permissions)
      if (visibleChildren.length === 0) continue
      filtered.push({ ...item, children: visibleChildren })
    } else {
      filtered.push(item)
    }
  }

  return filtered
}

export { ChevronDown }
