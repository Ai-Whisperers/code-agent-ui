import { useState } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import codeAgentLogo from '@/assets/code-agent-logo.png'
import { Menu } from '@/components/navigation/menu/Menu'
import { ApplicationMenuItems } from '@/config/applicationMenu'
import { logout } from '@/store/auth-store'
import type { AuthUser } from '@/store/auth-store'

interface SideBarProps {
  user: AuthUser
  isMobileExpanded?: boolean
  onNavigate?: () => void
}

function getUserInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

export function SideBar({ user, isMobileExpanded = false, onNavigate }: SideBarProps) {
  const [isHovered, setIsHovered] = useState(false)
  const navigate = useNavigate()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const isExpanded = isMobileExpanded || isHovered

  const menuItems = ApplicationMenuItems(navigate, currentPath, onNavigate)

  return (
    <div
      className={`
        flex flex-col h-full
        bg-[var(--color-navigation-menu-card)]
        border-r border-[var(--color-navigation-menu-border)]
        transition-all duration-200
        ${isMobileExpanded ? 'w-full' : 'w-[58px] hover:w-56'}
        overflow-hidden
      `}
      onMouseEnter={() => !isMobileExpanded && setIsHovered(true)}
      onMouseLeave={() => !isMobileExpanded && setIsHovered(false)}
    >
      {/* Logo / Brand */}
      <div
        className="flex items-center gap-3 px-3 py-4 shrink-0 cursor-pointer"
        onClick={() => navigate({ to: '/' })}
      >
        <img src={codeAgentLogo} alt="Code Agent" className="w-8 h-8 shrink-0 object-contain" />
        {isExpanded && (
          <span className="text-sm font-bold text-[var(--color-fonts-font-color-headings)] truncate whitespace-nowrap">
            Code Agent
          </span>
        )}
      </div>

      <div className="h-px bg-[var(--color-navigation-menu-border)] mx-3 shrink-0" />

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <Menu items={menuItems} isExpanded={isExpanded} />
      </div>

      <div className="h-px bg-[var(--color-navigation-menu-border)] mx-3 shrink-0" />

      {/* User avatar + logout */}
      <div className="px-2 py-3 shrink-0">
        <div className="flex items-center gap-3 px-1 py-2">
          <div className="w-8 h-8 shrink-0 rounded-full bg-[var(--color-navigation-user-avatar-background)] flex items-center justify-center text-xs font-bold text-white">
            {getUserInitials(user.name || user.username)}
          </div>
          {isExpanded && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--color-fonts-font-color-primary)] truncate">
                {user.name || user.username}
              </p>
              <p className="text-xs text-[var(--color-fonts-font-color-support)] truncate">
                {user.email}
              </p>
            </div>
          )}
          {isExpanded && (
            <button
              onClick={() => logout()}
              className="shrink-0 p-1 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors text-[var(--color-icons-icon)]"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
