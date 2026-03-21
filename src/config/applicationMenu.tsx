import {
  LayoutDashboard,
  Wrench,
  Settings,
  GitBranch,
  BarChart3,
  MessageSquare,
  ChevronDown,
  BookOpen,
  FolderGit2,
  Zap,
  FileText,
  Brain,
  Users,
  Sliders,
  ShieldCheck,
  GitPullRequest,
  BotMessageSquare,
  Plug,
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
      isActive: currentPath.startsWith('/metrics') || currentPath.startsWith('/stats'),
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
          id: 'ai-stats',
          label: 'AI Stats',
          icon: <BotMessageSquare size={16} />,
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
          icon: <FolderGit2 size={16} />,
          path: '/settings/repos',
          isActive: currentPath === '/settings/repos',
          type: 'item',
          onClick: () => go('/settings/repos'),
        },
        {
          id: 'hooks',
          label: 'Hooks',
          icon: <Zap size={16} />,
          path: '/settings/hooks',
          isActive: currentPath === '/settings/hooks',
          type: 'item',
          onClick: () => go('/settings/hooks'),
        },
        {
          id: 'prompts',
          label: 'Prompts',
          icon: <FileText size={16} />,
          path: '/settings/prompts',
          isActive: currentPath === '/settings/prompts',
          type: 'item',
          onClick: () => go('/settings/prompts'),
        },
        {
          id: 'memories',
          label: 'Memories',
          icon: <Brain size={16} />,
          path: '/settings/memories',
          isActive: currentPath === '/settings/memories',
          type: 'item',
          onClick: () => go('/settings/memories'),
        },
        {
          id: 'customers',
          label: 'Customers',
          icon: <Users size={16} />,
          path: '/settings/customers',
          isActive: currentPath === '/settings/customers',
          type: 'item',
          onClick: () => go('/settings/customers'),
        },
        {
          id: 'knowledge-index',
          label: 'Knowledge Index',
          icon: <BookOpen size={16} />,
          path: '/settings/knowledge',
          isActive: currentPath === '/settings/knowledge',
          type: 'item',
          onClick: () => go('/settings/knowledge'),
        },
        {
          id: 'mcp-profiles',
          label: 'MCP Profiles',
          icon: <Plug size={16} />,
          path: '/settings/mcp-profiles',
          isActive: currentPath === '/settings/mcp-profiles',
          type: 'item',
          onClick: () => go('/settings/mcp-profiles'),
        },
        {
          id: 'system-settings',
          label: 'System',
          icon: <Sliders size={16} />,
          path: '/settings/system',
          isActive: currentPath === '/settings/system',
          type: 'item',
          onClick: () => go('/settings/system'),
        },
      ],
    },
  ]
}

export { ChevronDown }
