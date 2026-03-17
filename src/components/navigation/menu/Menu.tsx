import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { NavigationMenuItem } from '@/config/applicationMenu'

interface MenuProps {
  items: NavigationMenuItem[]
  isExpanded: boolean
}

function MenuItem({ item, isExpanded }: { item: NavigationMenuItem; isExpanded: boolean }) {
  const [open, setOpen] = useState(item.isActive ?? false)

  if (item.type === 'parent' && item.children) {
    return (
      <div>
        <button
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
            item.isActive
              ? 'bg-[var(--color-navigation-menu-item-active)] text-[var(--color-navigation-menu-item-hover-font)]'
              : 'text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-navigation-menu-item-hover-background)] hover:text-[var(--color-navigation-menu-item-hover-font)]'
          }`}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="shrink-0 text-[var(--color-icons-icon)]">{item.icon}</span>
          {isExpanded && (
            <>
              <span className="flex-1 text-sm font-medium truncate">{item.label}</span>
              <ChevronDown
                size={14}
                className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </>
          )}
        </button>
        {isExpanded && open && (
          <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-[var(--color-navigation-menu-border)] pl-3">
            {item.children.map((child) => (
              <MenuItem key={child.id} item={child} isExpanded={isExpanded} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
        item.isActive
          ? 'bg-[var(--color-navigation-menu-item-active)] text-[var(--color-navigation-menu-item-hover-font)]'
          : 'text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-navigation-menu-item-hover-background)] hover:text-[var(--color-navigation-menu-item-hover-font)]'
      }`}
      onClick={item.onClick}
    >
      {item.icon && (
        <span className="shrink-0 text-[var(--color-icons-icon)]">{item.icon}</span>
      )}
      {isExpanded && (
        <span className="flex-1 text-sm font-medium truncate">{item.label}</span>
      )}
    </button>
  )
}

export function Menu({ items, isExpanded }: MenuProps) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => (
        <MenuItem key={item.id} item={item} isExpanded={isExpanded} />
      ))}
    </nav>
  )
}
