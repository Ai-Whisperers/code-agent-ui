import {
  LayoutDashboard,
  Wrench,
  Settings,
  GitBranch,
  BarChart3,
  ChevronDown,
} from 'lucide-react'

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
}

export function ApplicationMenuItems(
  navigate: (opts: { to: string }) => void,
  currentPath: string,
  onNavigate?: () => void,
): NavigationMenuItem[] {
  const go = (to: string) => {
    navigate({ to })
    onNavigate?.()
  }

  return [
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
      isActive: currentPath.startsWith('/metrics') || currentPath.startsWith('/stats'),
      children: [
        {
          id: 'quality-reports',
          label: 'Quality Reports',
          path: '/metrics/quality',
          isActive: currentPath === '/metrics/quality',
          type: 'item',
          onClick: () => go('/metrics/quality'),
        },
        {
          id: 'review-metrics',
          label: 'Review Metrics',
          path: '/metrics/reviews',
          isActive: currentPath === '/metrics/reviews',
          type: 'item',
          onClick: () => go('/metrics/reviews'),
        },
        {
          id: 'ai-stats',
          label: 'AI Stats',
          path: '/stats',
          isActive: currentPath === '/stats',
          type: 'item',
          onClick: () => go('/stats'),
        },
      ],
    },
    {
      id: 'settings-section',
      label: 'Settings',
      type: 'parent',
      icon: <Settings size={18} />,
      isActive: currentPath.startsWith('/settings'),
      children: [
        {
          id: 'repos',
          label: 'Repositories',
          path: '/settings/repos',
          isActive: currentPath === '/settings/repos',
          type: 'item',
          onClick: () => go('/settings/repos'),
        },
        {
          id: 'hooks',
          label: 'Hooks',
          path: '/settings/hooks',
          isActive: currentPath === '/settings/hooks',
          type: 'item',
          onClick: () => go('/settings/hooks'),
        },
        {
          id: 'prompts',
          label: 'Prompts',
          path: '/settings/prompts',
          isActive: currentPath === '/settings/prompts',
          type: 'item',
          onClick: () => go('/settings/prompts'),
        },
        {
          id: 'memories',
          label: 'Memories',
          path: '/settings/memories',
          isActive: currentPath === '/settings/memories',
          type: 'item',
          onClick: () => go('/settings/memories'),
        },
      ],
    },
  ]
}

export { ChevronDown }
