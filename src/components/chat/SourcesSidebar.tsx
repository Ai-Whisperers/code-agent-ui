import { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { X, ExternalLink } from 'lucide-react'
import type { WebSource } from '@/types/api'
import { sourceDomain, faviconUrl } from './webSourceUtils'

interface SourcesSidebarProps {
  sources: WebSource[]
  onClose: () => void
}

export function SourcesSidebar({ sources, onClose }: SourcesSidebarProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Derive a single representative query label (first non-empty query)
  const queryLabel = sources.find((s) => s.query)?.query

  // Sources are already deduplicated by extractWebSources() before storage
  const unique = sources

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel — right side */}
      <div
        ref={panelRef}
        className={[
          'absolute right-0 top-0 h-full w-80 flex flex-col',
          'bg-[var(--color-cards-card-background)]',
          'border-l border-[var(--color-borders-border-primary)]',
          'shadow-2xl',
          'animate-slide-in-right',
        ].join(' ')}
        role="dialog"
        aria-label="Search sources"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-borders-border-primary)] shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)]">
              Sources
              <span className="ml-1.5 font-normal text-[var(--color-fonts-font-color-support)]">
                ({unique.length})
              </span>
            </p>
            {queryLabel && (
              <p className="text-[11px] text-[var(--color-fonts-font-color-support)] truncate mt-0.5">
                for &ldquo;{queryLabel}&rdquo;
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-md text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-page-background)] transition-colors"
            aria-label="Close sources"
          >
            <X size={14} />
          </button>
        </div>

        {/* Source list */}
        <div className="flex-1 overflow-y-auto py-2">
          {unique.map((source, i) => (
            <a
              key={`${source.url}-${i}`}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className={[
                'flex items-start gap-3 px-4 py-3 group',
                'hover:bg-[var(--color-page-background)] transition-colors',
                'border-b border-[var(--color-borders-border-primary)]/40 last:border-0',
              ].join(' ')}
            >
              {/* Number + favicon */}
              <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
                <span className="text-[10px] font-bold tabular-nums text-[var(--color-fonts-font-color-support)] w-4 text-center leading-none">
                  {i + 1}
                </span>
                <img
                  src={faviconUrl(source.url)}
                  alt=""
                  width={14}
                  height={14}
                  className="rounded-sm opacity-80"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--color-fonts-font-color-primary)] leading-snug group-hover:text-[var(--color-buttons-button-primary)] line-clamp-2 mb-0.5">
                  {source.title}
                </p>
                <p className="text-[10px] text-[var(--color-fonts-font-color-support)] truncate mb-1">
                  {sourceDomain(source.url)}
                </p>
                {source.snippet && (
                  <p className="text-[11px] text-[var(--color-fonts-font-color-support)] leading-relaxed line-clamp-3">
                    {source.snippet}
                  </p>
                )}
              </div>

              {/* External link icon */}
              <ExternalLink
                size={11}
                className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-50 transition-opacity"
              />
            </a>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
