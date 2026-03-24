import { useState } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useStore } from '@tanstack/react-store'
import { Menu, X, Bot } from 'lucide-react'
import { SideBar } from './SideBar'
import { authStore } from '@/store/auth-store'

export default function MainLayout() {
  const user = useStore(authStore, (s) => s.user)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  useRouterState()

  if (!user) return null

  return (
    <>
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[var(--color-navigation-menu-card)] border-b border-[var(--color-navigation-menu-border)]">
        <div className="flex items-center justify-between h-14 px-4">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate({ to: '/' })}
          >
            <div className="w-7 h-7 rounded-lg bg-[var(--color-buttons-button-primary)] flex items-center justify-center">
              <Bot size={15} className="text-white" />
            </div>
            <span className="text-sm font-bold text-[var(--color-fonts-font-color-headings)]">
              Code Agent
            </span>
          </div>
          <button
            className="p-1.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)]"
            onClick={() => setIsMobileMenuOpen((o) => !o)}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 mt-14">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-72 h-full">
            <SideBar
              user={user}
              isMobileExpanded
              onNavigate={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Desktop layout */}
      <div className="hidden md:flex h-screen overflow-hidden">
        <SideBar user={user} />
        <main className="flex-1 overflow-y-auto bg-[var(--color-page-background)]">
          <div className="px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile content */}
      <div className={`md:hidden mt-14 min-h-[calc(100vh-56px)] bg-[var(--color-page-background)] ${isMobileMenuOpen ? 'hidden' : ''}`}>
        <div className="px-4 py-5">
          <Outlet />
        </div>
      </div>
    </>
  )
}
