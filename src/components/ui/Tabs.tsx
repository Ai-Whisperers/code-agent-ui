// ── Tabs ──────────────────────────────────────────────────────────────────────
// Underline-style tab bar extracted from JobDetail.tsx for shared use.

import { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ── TabBar ────────────────────────────────────────────────────────────────────

interface TabBarProps {
  children: React.ReactNode
  className?: string
}

export function TabBar({ children, className = '' }: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft]   = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      ro.disconnect()
    }
  }, [checkScroll])

  const scroll = (dir: 1 | -1) =>
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' })

  return (
    <div
      className={`relative flex items-center border-b border-[var(--color-borders-border-primary)] ${className}`}
    >
      {/* Left scroll chevron — only shown when content is clipped on the left */}
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Scroll tabs left"
        className={[
          'shrink-0 flex items-center justify-center w-5 self-stretch',
          'text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]',
          'transition-all duration-150',
          canScrollLeft ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none w-0',
        ].join(' ')}
      >
        <ChevronLeft size={13} />
      </button>

      {/* Scrollable tab list */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0"
      >
        {children}
      </div>

      {/* Right scroll chevron — only shown when content is clipped on the right */}
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="Scroll tabs right"
        className={[
          'shrink-0 flex items-center justify-center w-5 self-stretch',
          'text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]',
          'transition-all duration-150',
          canScrollRight ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none w-0',
        ].join(' ')}
      >
        <ChevronRight size={13} />
      </button>
    </div>
  )
}

// ── TabButton ─────────────────────────────────────────────────────────────────

export interface TabButtonProps {
  active: boolean
  onClick: () => void
  /** Optional numeric/string badge rendered as a pill */
  badge?: string
  children: React.ReactNode
}

export function TabButton({ active, onClick, badge, children }: TabButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null)

  // Scroll the button into view whenever it becomes active (handles both user clicks
  // and programmatic tab switches like when AI proposes new tabs).
  useEffect(() => {
    if (active) {
      btnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [active])

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={onClick}
      className={[
        'relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors shrink-0',
        'border-b-2 -mb-px',
        active
          ? 'border-[var(--color-fonts-font-color-brand)] text-[var(--color-fonts-font-color-primary)]'
          : 'border-transparent text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:border-[var(--color-borders-border-primary)]',
      ].join(' ')}
    >
      {children}
      {badge && (
        <span className="inline-flex items-center justify-center rounded-full px-1.5 min-w-[18px] h-[18px] text-[10px] font-semibold bg-[var(--color-tags-neutral-background)] text-[var(--color-fonts-font-color-support)]">
          {badge}
        </span>
      )}
    </button>
  )
}
