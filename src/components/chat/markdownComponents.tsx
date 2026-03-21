import type { Components } from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { MermaidDiagram } from './MermaidDiagram'
import { ChartBlock } from './ChartBlock'

export const markdownComponents: Components = {
  pre({ children }) {
    return <>{children}</>
  },
  code({ className, children }) {
    const match = /language-(\w+)/.exec(className ?? '')
    const language = match?.[1] ?? ''
    const code = String(children).replace(/\n$/, '')

    if (!match) {
      return (
        <code className="px-1.5 py-0.5 rounded text-[0.8em] font-mono bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)] border border-[var(--color-cards-card-stroke)]">
          {children}
        </code>
      )
    }

    if (language === 'mermaid') {
      return <MermaidDiagram code={code} />
    }

    if (language === 'chart' || language === 'chartjs') {
      return <ChartBlock code={code} />
    }

    // Detect Chart.js configs in javascript/json blocks: must have both
    // a recognised chart type AND a datasets array.
    if (language === 'javascript' || language === 'js' || language === 'json') {
      const looksLikeChart =
        /\btype\s*[:=]\s*['"`]?(bar|line|pie|doughnut|radar|polarArea)\b/i.test(code) &&
        /\bdatasets\s*[:[]/.test(code)
      if (looksLikeChart) {
        return <ChartBlock code={code} />
      }
    }

    return (
      <div className="my-3 rounded-[var(--border-radius-card)] overflow-hidden text-sm">
        <div className="flex items-center px-4 py-1.5 bg-[#282c34] border-b border-white/10">
          <span className="text-xs font-mono text-[#abb2bf] uppercase tracking-wider">
            {language}
          </span>
        </div>
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.8125rem' }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    )
  },
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-[var(--color-fonts-font-color-headings)] mt-5 mb-2 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-[var(--color-fonts-font-color-headings)] mt-4 mb-2 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-[var(--color-fonts-font-color-headings)] mt-3 mb-1 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 text-sm leading-relaxed text-[var(--color-fonts-font-color-primary)]">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 ml-5 list-disc space-y-1 text-sm text-[var(--color-fonts-font-color-primary)]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-5 list-decimal space-y-1 text-sm text-[var(--color-fonts-font-color-primary)]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 pl-4 border-l-4 border-[var(--color-buttons-button-primary)] italic text-sm text-[var(--color-fonts-font-color-support)]">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)]">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[var(--color-cards-card-background)]">{children}</thead>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-[var(--color-cards-card-stroke)] last:border-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-fonts-font-color-headings)] uppercase tracking-wide">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2 text-[var(--color-fonts-font-color-primary)]">{children}</td>
  ),
  hr: () => <hr className="my-4 border-[var(--color-cards-card-stroke)]" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--color-buttons-button-primary)] underline hover:opacity-80"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--color-fonts-font-color-headings)]">
      {children}
    </strong>
  ),
}
