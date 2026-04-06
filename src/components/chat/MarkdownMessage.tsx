import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { markdownComponents } from './markdownComponents'
import { splitThinkingBlocks } from './streamingUtils'

export function MarkdownMessage({ content }: { content: string }) {
  const segments = useMemo(() => splitThinkingBlocks(content), [content])

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
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {seg.content}
          </ReactMarkdown>
        )
      })}
    </>
  )
}
