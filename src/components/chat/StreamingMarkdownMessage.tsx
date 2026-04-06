import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Loader2 } from 'lucide-react'
import { markdownComponents } from './markdownComponents'
import { patchStreamingContent, DIAGRAM_LOADING_PLACEHOLDER } from './streamingUtils'

/**
 * Streaming-safe variant of MarkdownMessage.
 *
 * Before passing accumulated content to react-markdown it runs
 * patchStreamingContent(), which:
 *   - closes any non-special open code fence so the parser doesn't swallow
 *     the rest of the document as code
 *   - replaces any in-flight mermaid/chart/chartjs block with a placeholder
 *     so mermaid.render() is never called with partial/invalid syntax
 *
 * The placeholder is rendered as a subtle "Rendering diagram…" spinner via a
 * custom `code` component override. When the block's closing fence arrives the
 * next RAF update will contain valid content and MermaidDiagram / ChartBlock
 * render normally.
 */
export function StreamingMarkdownMessage({ content }: { content: string }) {
  const safeContent = useMemo(() => patchStreamingContent(content), [content])

  const components = useMemo(() => ({
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

      // Delegate to the shared component map for all other code blocks
      const sharedCode = markdownComponents.code
      if (sharedCode) {
        const SharedCode = sharedCode as React.ComponentType<React.ComponentPropsWithoutRef<'code'> & { className?: string }>
        return <SharedCode className={className} {...props}>{children}</SharedCode>
      }

      return <code className={className} {...props}>{children}</code>
    },
  }), [])

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {safeContent}
    </ReactMarkdown>
  )
}
