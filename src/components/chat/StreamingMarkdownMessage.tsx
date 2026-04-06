import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Loader2 } from 'lucide-react'
import { markdownComponents } from './markdownComponents'
import { splitThinkingBlocks, patchStreamingContent, DIAGRAM_LOADING_PLACEHOLDER } from './streamingUtils'

/**
 * Streaming-safe variant of MarkdownMessage.
 *
 * Handles two concerns before handing content to react-markdown:
 *
 * 1. <thinking>…</thinking> blocks — models sometimes emit these as literal
 *    XML in their text stream. Each block is extracted and rendered with a
 *    muted "internal thought" style instead of as normal markdown.
 *
 * 2. Unclosed code fences — patchStreamingContent() closes any open fence so
 *    react-markdown never sees truly un-terminated fences, and replaces
 *    in-flight diagram blocks with a spinner placeholder.
 *
 * The ▍ cursor is appended to whichever segment is last so the eye always
 * has a focal point at the leading edge of the stream.
 */
export function StreamingMarkdownMessage({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const streamingComponents = useMemo(() => ({
    ...markdownComponents,
    code({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { className?: string }) {
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
        const SharedCode = sharedCode as React.ComponentType<React.ComponentPropsWithoutRef<'code'> & { className?: string }>
        return <SharedCode className={className} {...props}>{children}</SharedCode>
      }

      return <code className={className} {...props}>{children}</code>
    },
  }), [])

  const segments = useMemo(() => {
    const raw = splitThinkingBlocks(content)
    return raw.map((seg, i) => {
      const isLast = i === raw.length - 1
      const cursor = isStreaming && isLast ? ' ▍' : ''

      if (seg.type === 'thinking') {
        return { ...seg, content: seg.content + cursor }
      }

      return { ...seg, content: patchStreamingContent(seg.content) + cursor }
    })
  }, [content, isStreaming])

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'thinking') {
          const text = seg.content.trim()
          if (!text) return null
          return (
            <p
              key={i}
              className="text-[11px] font-mono leading-relaxed text-[var(--color-fonts-font-color-support)] opacity-35 border-l border-[var(--color-cards-card-stroke)] pl-2 mb-2"
            >
              {text}
            </p>
          )
        }
        return (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={streamingComponents}>
            {seg.content}
          </ReactMarkdown>
        )
      })}
    </>
  )
}
