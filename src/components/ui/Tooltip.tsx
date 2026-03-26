import { useState } from 'react'

/**
 * Lightweight tooltip using fixed positioning so it is never clipped by
 * overflow-x-auto containers (e.g. table wrappers).
 */
export function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  return (
    <div
      className="inline-flex"
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        setPos({ x: rect.left + rect.width / 2, y: rect.top })
        setVisible(true)
      }}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y - 6,
            transform: 'translate(-50%, -100%)',
          }}
          className="z-[9999] px-2 py-1 text-[10px] leading-tight rounded-md bg-gray-900 text-gray-100 whitespace-pre-line pointer-events-none shadow-md max-w-xs text-left"
        >
          {text}
        </span>
      )}
    </div>
  )
}
