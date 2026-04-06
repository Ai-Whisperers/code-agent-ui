import {
  LayoutDashboard,
  Wrench,
  BriefcaseBusiness,
  Settings,
  GitBranch,
  MessageSquare,
  ChevronDown,
  BookOpen,
  ClipboardList,
  FolderGit2,
  Zap,
  FileText,
  Brain,
  Users,
  UserCog,
  Sliders,
  ShieldCheck,
  GitPullRequest,
  BotMessageSquare,
  ScrollText,
  Target,
  Lock,
  FlaskConical,
  Filter,
  Network,
  GitCommit,
  ScanSearch,
  Timer,
  TrendingUp,
  BarChart2,
  Telescope,
  BadgeCheck,
  Cpu,
  LineChart,
} from 'lucide-react'
import type { Permission } from '@/lib/permissions'

export interface NavigationMenuBadge {
  label: string
  bgColor: string
  textColor: string
}

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
  /** Optional count badges rendered next to the label when the sidebar is expanded */
  badges?: NavigationMenuBadge[]
}

export interface SecurityCounts {
  criticals: number
  highs: number
}

export function ApplicationMenuItems(
  navigate: (opts: { to: string }) => void,
  currentPath: string,
  permissions: Set<Permission>,
  onNavigate?: () => void,
  securityCounts?: SecurityCounts,
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
      id: 'work-section',
      label: 'Work',
      type: 'parent',
      icon: <BriefcaseBusiness size={18} />,
      isActive: currentPath.startsWith('/jobs') || currentPath.startsWith('/plans') || currentPath.startsWith('/pull-requests'),
      children: [
        {
          id: 'jobs',
          label: 'Jobs',
          icon: <Wrench size={16} />,
          path: '/jobs',
          isActive: currentPath.startsWith('/jobs'),
          type: 'item',
          onClick: () => go('/jobs'),
        },
        {
          id: 'plans',
          label: 'Plans',
          icon: <GitBranch size={16} />,
          path: '/plans',
          isActive: currentPath.startsWith('/plans'),
          type: 'item',
          onClick: () => go('/plans'),
        },
        {
          id: 'pull-requests',
          label: 'Pull Requests',
          icon: <GitPullRequest size={16} />,
          path: '/pull-requests',
          isActive: currentPath.startsWith('/pull-requests'),
          type: 'item',
          requiredPermission: 'VIEW_PULL_REQUESTS',
          onClick: () => go('/pull-requests'),
        },
      ],
    },
    {
      id: 'insights-section',
      label: 'Insights',
      type: 'parent',
      icon: <Telescope size={18} />,
      isActive: currentPath.startsWith('/metrics') || currentPath.startsWith('/stats'),
      children: [
        // ── Code quality ──────────────────────────────────────────────────────
        {
          id: 'quality-reports',
          label: 'Quality Reports',
          icon: <BadgeCheck size={16} />,
          path: '/metrics/quality',
          isActive: currentPath === '/metrics/quality',
          type: 'item',
          onClick: () => go('/metrics/quality'),
        },
        {
          id: 'coverage-trend',
          label: 'Coverage Trend',
          icon: <TrendingUp size={16} />,
          path: '/metrics/coverage-trend',
          isActive: currentPath === '/metrics/coverage-trend',
          type: 'item',
          onClick: () => go('/metrics/coverage-trend'),
        },
        {
          id: 'scope',
          label: 'Scopes',
          icon: <Target size={16} />,
          path: '/metrics/scope',
          isActive: currentPath.startsWith('/metrics/scope'),
          type: 'item',
          requiredPermission: 'VIEW_SCOPE',
          onClick: () => go('/metrics/scope'),
        },
        // ── Delivery ──────────────────────────────────────────────────────────
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
          id: 'pr-cycle-time',
          label: 'PR Cycle Time',
          icon: <Timer size={16} />,
          path: '/metrics/pr-cycle-time',
          isActive: currentPath === '/metrics/pr-cycle-time',
          type: 'item',
          onClick: () => go('/metrics/pr-cycle-time'),
        },
        // ── People ────────────────────────────────────────────────────────────
        {
          id: 'developer-scorecard',
          label: 'Developer Scorecard',
          icon: <LineChart size={16} />,
          path: '/metrics/developers',
          isActive: currentPath === '/metrics/developers',
          type: 'item',
          onClick: () => go('/metrics/developers'),
        },
        // ── AI ────────────────────────────────────────────────────────────────
        {
          id: 'ai-effectiveness',
          label: 'AI Effectiveness',
          icon: <BotMessageSquare size={16} />,
          path: '/metrics/ai-effectiveness',
          isActive: currentPath === '/metrics/ai-effectiveness',
          type: 'item',
          onClick: () => go('/metrics/ai-effectiveness'),
        },
        {
          id: 'ai-stats',
          label: 'AI Stats',
          icon: <BarChart2 size={16} />,
          path: '/stats',
          isActive: currentPath === '/stats',
          type: 'item',
          onClick: () => go('/stats'),
        },
        // ── Knowledge ─────────────────────────────────────────────────────────
        {
          id: 'knowledge-graph',
          label: 'Knowledge Graph',
          icon: <GitCommit size={16} />,
          path: '/metrics/knowledge-graph',
          isActive: currentPath === '/metrics/knowledge-graph',
          type: 'item',
          onClick: () => go('/metrics/knowledge-graph'),
        },
      ],
    },
    {
      id: 'engineering-section',
      label: 'Engineering',
      type: 'parent',
      icon: <Cpu size={18} />,
      isActive: currentPath === '/architecture' || currentPath === '/log-analysis',
      children: [
        {
          id: 'architecture',
          label: 'Architecture',
          icon: <Network size={16} />,
          path: '/architecture',
          isActive: currentPath === '/architecture',
          type: 'item',
          requiredPermission: 'MANAGE_SETTINGS',
          onClick: () => go('/architecture'),
        },
        {
          id: 'log-analysis',
          label: 'Log Analysis',
          icon: <ScanSearch size={16} />,
          path: '/log-analysis',
          isActive: currentPath === '/log-analysis',
          type: 'item',
          onClick: () => go('/log-analysis'),
        },
      ],
    },
    {
      id: 'qa-section',
      label: 'QA',
      type: 'parent',
      icon: <FlaskConical size={18} />,
      isActive: currentPath.startsWith('/qa/'),
      requiredPermission: 'VIEW_SCOPE',
      children: [
        {
          id: 'qa-scopes',
          label: 'QA Scopes',
          icon: <Target size={16} />,
          path: '/qa/scope',
          isActive: currentPath.startsWith('/qa/scope'),
          type: 'item',
          onClick: () => go('/qa/scope'),
        },
        {
          id: 'qa-test-plans',
          label: 'Test Plans',
          icon: <ClipboardList size={16} />,
          path: '/qa/test-plans',
          isActive: currentPath.startsWith('/qa/test-plans'),
          type: 'item',
          onClick: () => go('/qa/test-plans'),
        },
      ],
    },
    {
      id: 'soc2-section',
      label: 'SOC II',
      type: 'parent',
      icon: <ShieldCheck size={18} />,
      isActive: currentPath.startsWith('/security') || currentPath.startsWith('/compliance'),
      requiredPermission: 'VIEW_SECURITY',
      badges: [
        ...(securityCounts && securityCounts.criticals > 0
          ? [{ label: `${securityCounts.criticals}C`, bgColor: '#dc2626', textColor: '#ffffff' }]
          : []),
        ...(securityCounts && securityCounts.highs > 0
          ? [{ label: `${securityCounts.highs}H`, bgColor: '#f97316', textColor: '#ffffff' }]
          : []),
      ],
      children: [
        {
          id: 'security-issues',
          label: 'Security Issues',
          icon: <Lock size={16} />,
          path: '/security/issues',
          isActive: currentPath === '/security/issues',
          type: 'item',
          requiredPermission: 'VIEW_SECURITY',
          onClick: () => go('/security/issues'),
        },
        {
          id: 'soc2-audit',
          label: 'SOC II Audit',
          icon: <ClipboardList size={16} />,
          path: '/compliance/soc2',
          isActive: currentPath === '/compliance/soc2',
          type: 'item',
          onClick: () => go('/compliance/soc2'),
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
        // ── Infrastructure ────────────────────────────────────────────────────
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
          id: 'integration-filters',
          label: 'Integrations',
          icon: <Filter size={16} />,
          path: '/settings/integrations',
          isActive: currentPath === '/settings/integrations',
          type: 'item',
          requiredPermission: 'MANAGE_SETTINGS',
          onClick: () => go('/settings/integrations'),
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
        // ── Agent configuration ───────────────────────────────────────────────
        {
          id: 'job-configuration',
          label: 'Job Configuration',
          icon: <Cpu size={16} />,
          path: '/settings/jobs',
          isActive: currentPath === '/settings/jobs',
          type: 'item',
          requiredPermission: 'MANAGE_SETTINGS',
          onClick: () => go('/settings/jobs'),
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
          id: 'knowledge-index',
          label: 'Knowledge Index',
          icon: <BookOpen size={16} />,
          path: '/settings/knowledge',
          isActive: currentPath === '/settings/knowledge',
          type: 'item',
          requiredPermission: 'MANAGE_SETTINGS',
          onClick: () => go('/settings/knowledge'),
        },
        // ── Data ──────────────────────────────────────────────────────────────
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
        // ── People ────────────────────────────────────────────────────────────
        {
          id: 'admin-users',
          label: 'Users',
          icon: <UserCog size={16} />,
          path: '/settings/users',
          isActive: currentPath === '/settings/users',
          type: 'item',
          requiredPermission: 'MANAGE_USERS',
          onClick: () => go('/settings/users'),
        },
        {
          id: 'teams',
          label: 'Teams',
          icon: <Users size={16} />,
          path: '/settings/teams',
          isActive: currentPath === '/settings/teams',
          type: 'item',
          requiredPermission: 'MANAGE_USERS',
          onClick: () => go('/settings/teams'),
        },
        // ── System ────────────────────────────────────────────────────────────
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
        // ── Audit ─────────────────────────────────────────────────────────────
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
