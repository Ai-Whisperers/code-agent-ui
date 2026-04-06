import { useState } from 'react'
import { GripVertical } from 'lucide-react'

interface ResizableDividerProps {
  /** Called continuously during drag with the raw clientX position. */
  onDrag: (clientX: number) => void
}

/**
 * A 1 px vertical split-pane divider with a centred grab-handle that appears
 * on hover. Dragging the divider calls `onDrag` with the cursor's clientX so
 * the parent can recalculate panel widths.
 */
export function ResizableDivider({ onDrag }: ResizableDividerProps) {
  const [active, setActive] = useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setActive(true)

    const onMove = (ev: MouseEvent) => onDrag(ev.clientX)
    const onUp = () => {
      setActive(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      className="group relative flex items-center justify-center shrink-0 w-1 cursor-col-resize select-none z-10"
    >
      {/* Wider invisible hit area — extends rightward only so it doesn't cover the left panel's scrollbar */}
      <div className="absolute inset-y-0 left-0 -right-3" />

      {/* Visual line */}
      <div
        className={[
          'w-px h-full transition-colors duration-150',
          active
            ? 'bg-[var(--color-buttons-button-primary)]'
            : 'bg-[var(--color-borders-border-primary)] opacity-50 group-hover:opacity-100 group-hover:bg-[var(--color-buttons-button-primary)]',
        ].join(' ')}
      />

      {/* Grab handle pill — fades in on hover / drag */}
      <div
        className={[
          'absolute z-20 flex items-center justify-center',
          'w-5 h-10 rounded-full',
          'bg-[var(--color-cards-card-background)] border border-[var(--color-borders-border-primary)]',
          'shadow-md transition-all duration-150',
          active
            ? 'opacity-100 border-[var(--color-buttons-button-primary)] text-[var(--color-buttons-button-primary)] scale-110'
            : 'opacity-0 group-hover:opacity-100 text-[var(--color-fonts-font-color-support)] group-hover:text-[var(--color-buttons-button-primary)] group-hover:border-[var(--color-buttons-button-primary)]',
        ].join(' ')}
      >
        <GripVertical size={12} strokeWidth={2} />
      </div>
    </div>
  )
}
