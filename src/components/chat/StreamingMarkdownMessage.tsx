import { useMemo, useRef, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Loader2 } from 'lucide-react'
import { markdownComponents } from './markdownComponents'
import { splitThinkingBlocks, patchStreamingContent, DIAGRAM_LOADING_PLACEHOLDER } from './streamingUtils'
import type { Components } from 'react-markdown'

/**
 * Renders settled (paragraph-complete) markdown content.
 *
 * Wrapped in React.memo so it only re-renders when the settled string actually
 * grows (a new paragraph break was reached), not on every token arrival.
 * This prevents the full markdown re-parse from running 60 times/second for
 * already-stable content in long responses.
 */
const SettledMarkdown = memo(function SettledMarkdown({
  content,
  components,
}: {
  content: string
  components: Components
}) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  )
})

/**
 * Renders the last, still-growing paragraph with per-word fade-in animation.
 *
 * Words that existed in the previous render are stable (no re-animation).
 * Words that are new in this render get the `stream-word-in` keyframe so they
 * fade in smoothly rather than popping in all at once.
 *
 * When the active paragraph resets (e.g. a new paragraph starts and the old
 * one moves to settled), the word count drops below prevCount and we treat all
 * words as new, so the fresh paragraph also fades in correctly.
 */
function ActiveParagraph({ text }: { text: string }) {
  const prevWordCountRef = useRef(0)

  const words = useMemo(
    () => text.match(/\S+\s*/g) ?? (text ? [text] : []),
    [text],
  )

  // Reset when paragraph resets (new text is shorter than old paragraph)
  const prevCount = words.length < prevWordCountRef.current ? 0 : prevWordCountRef.current
  prevWordCountRef.current = words.length

  return (
    <p className="mb-3 last:mb-0 text-sm leading-relaxed text-[var(--color-fonts-font-color-primary)]">
      {words.map((word, i) => (
        <span
          key={i}
          style={
            i >= prevCount
              ? { animation: 'stream-word-in 140ms ease-out both' }
              : undefined
          }
        >
          {word}
        </span>
      ))}
    </p>
  )
}

/**
 * Renders the leading edge of a streaming response — either a plain paragraph
 * (uses ActiveParagraph for word-level animation) or a structured block like a
 * heading, list, or code fence (uses ReactMarkdown with the streaming
 * component overrides so diagrams still get the loading placeholder).
 */
function ActiveContent({
  text,
  components,
}: {
  text: string
  components: Components
}) {
  if (!text) return null

  // Headings (#), lists (- * + or 1.), code fences (`), tables (|),
  // blockquotes (>) are rendered via ReactMarkdown so structure is preserved.
  const isStructured = /^[#`|>]|^[-*+]\s|^\d+\.\s/.test(text.trimStart())

  if (isStructured) {
    return (
      <div className="stream-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {text}
        </ReactMarkdown>
      </div>
    )
  }

  return <ActiveParagraph text={text} />
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Streaming-safe markdown renderer with three layers of smoothness:
 *
 * 1. <thinking> blocks extracted and rendered with muted monospace styling
 *    (the model emits these as literal XML in its text stream).
 *
 * 2. Settled / active split — content before the last paragraph break is
 *    passed to SettledMarkdown (React.memo'd), so the full markdown re-parse
 *    only runs when a new paragraph completes, not on every token.
 *
 * 3. Word-by-word fade-in for the active (last) paragraph via ActiveParagraph,
 *    plus a CSS block-entrance animation for new structural elements.
 *
 * The ▍ cursor lands on the last segment's trailing edge so the eye always
 * has a focal anchor during streaming.
 */
export function StreamingMarkdownMessage({
  content,
  isStreaming,
}: {
  content: string
  isStreaming?: boolean
}) {
  const cursor = isStreaming ? ' ▍' : ''

  // Build streaming-specific component overrides once (stable reference)
  const streamingComponents = useMemo<Components>(
    () => ({
      ...markdownComponents,
      code({
        className,
        children,
        ...props
      }: React.ComponentPropsWithoutRef<'code'> & { className?: string }) {
        const code = String(children).replace(/\n$/, '')

        if (code === DIAGRAM_LOADING_PLACEHOLDER) {
          return (
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fonts-font-color-support)] py-1">
              <Loader2 size={12} className="animate-spin" />
              Rendering diagram…
            </span>
          )
        }

        const sharedCode = markdownComponents.code
        if (sharedCode) {
          const SharedCode = sharedCode as React.ComponentType<
            React.ComponentPropsWithoutRef<'code'> & { className?: string }
          >
          return (
            <SharedCode className={className} {...props}>
              {children}
            </SharedCode>
          )
        }

        return (
          <code className={className} {...props}>
            {children}
          </code>
        )
      },
    }),
    [],
  )

  // Split raw content on <thinking> boundaries first
  const rawSegments = useMemo(() => splitThinkingBlocks(content), [content])

  return (
    <>
      {rawSegments.map((seg, segIdx) => {
        const isLastSeg = segIdx === rawSegments.length - 1

        // ── Thinking segment ────────────────────────────────────────────────
        if (seg.type === 'thinking') {
          const text = (seg.content + (isStreaming && isLastSeg ? cursor : '')).trim()
          if (!text) return null
          return (
            <p
              key={segIdx}
              className="text-[11px] font-mono leading-relaxed text-[var(--color-fonts-font-color-support)] opacity-35 border-l border-[var(--color-cards-card-stroke)] pl-2 mb-2"
            >
              {text}
            </p>
          )
        }

        // ── Text segment ────────────────────────────────────────────────────
        const patched = patchStreamingContent(seg.content)

        // Non-streaming or non-last segments render fully (no split needed)
        if (!isStreaming || !isLastSeg) {
          return (
            <div key={segIdx} className="stream-md">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={streamingComponents}
              >
                {patched}
              </ReactMarkdown>
            </div>
          )
        }

        // ── Last text segment during streaming: settled + active split ──────
        const lastBreak = patched.lastIndexOf('\n\n')

        if (lastBreak === -1) {
          // No paragraph break yet — full content is active
          return (
            <div key={segIdx} className="stream-md">
              <ActiveContent
                text={patched + cursor}
                components={streamingComponents}
              />
            </div>
          )
        }

        const settled = patched.slice(0, lastBreak + 2)
        const active = patched.slice(lastBreak + 2)

        return (
          <div key={segIdx} className="stream-md">
            <SettledMarkdown content={settled} components={streamingComponents} />
            <ActiveContent text={active + cursor} components={streamingComponents} />
          </div>
        )
      })}
    </>
  )
}
