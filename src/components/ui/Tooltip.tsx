import { useState } from 'react'

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  text: string
  children: React.ReactNode
  position?: TooltipPosition
}

/**
 * Lightweight tooltip using fixed positioning so it is never clipped by
 * overflow-x-auto containers (e.g. table wrappers).
 */
export function Tooltip({ text, children, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)

  function getStyle(r: DOMRect): React.CSSProperties {
    const GAP = 6
    switch (position) {
      case 'bottom':
        return {
          position: 'fixed',
          left: r.left + r.width / 2,
          top: r.bottom + GAP,
          transform: 'translateX(-50%)',
        }
      case 'left':
        return {
          position: 'fixed',
          left: r.left - GAP,
          top: r.top + r.height / 2,
          transform: 'translate(-100%, -50%)',
        }
      case 'right':
        return {
          position: 'fixed',
          left: r.right + GAP,
          top: r.top + r.height / 2,
          transform: 'translateY(-50%)',
        }
      case 'top':
      default:
        return {
          position: 'fixed',
          left: r.left + r.width / 2,
          top: r.top - GAP,
          transform: 'translate(-50%, -100%)',
        }
    }
  }

  return (
    <div
      className="inline-flex"
      onMouseEnter={(e) => {
        setRect(e.currentTarget.getBoundingClientRect())
        setVisible(true)
      }}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && rect && (
        <span
          style={getStyle(rect)}
          className="z-[9999] px-2.5 py-1.5 text-[11px] font-normal normal-case leading-relaxed tracking-normal rounded-md bg-gray-900 text-gray-100 whitespace-pre-line pointer-events-none shadow-lg max-w-[240px] text-left"
        >
          {text}
        </span>
      )}
    </div>
  )
}
