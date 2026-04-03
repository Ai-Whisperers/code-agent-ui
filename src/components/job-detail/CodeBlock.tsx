import { memo, useMemo, Fragment } from 'react'
import Prism from 'prismjs'
// Language registrations — load base/dependency grammars first
import 'prismjs/components/prism-markup'   // must precede php, markdown (embeds HTML)
import 'prismjs/components/prism-css'      // must precede markup-templating dependents
import 'prismjs/components/prism-c'        // must precede cpp
import 'prismjs/components/prism-javascript' // must precede typescript, jsx, php
import 'prismjs/components/prism-markup-templating' // must precede php
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-csharp'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-kotlin'
import 'prismjs/components/prism-swift'
import 'prismjs/components/prism-ruby'
import 'prismjs/components/prism-scala'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'

export function languageFromFilename(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'jsx', js: 'javascript', jsx: 'jsx',
    java: 'java', cs: 'csharp', py: 'python', php: 'php',
    go: 'go', rs: 'rust', kt: 'kotlin', swift: 'swift',
    rb: 'ruby', scala: 'scala', sc: 'scala',
    cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
    sh: 'bash', bash: 'bash', zsh: 'bash',
    sql: 'sql', json: 'json', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', css: 'css', scss: 'css', less: 'css',
    xml: 'markup', html: 'markup', htm: 'markup', svg: 'markup',
  }
  return ext ? map[ext] : undefined
}

export const HunkHeaderRow = memo(function HunkHeaderRow({ header }: { header: string }) {
  return (
    <tr className="bg-sky-500/10 border-y border-sky-500/20">
      <td
        colSpan={4}
        className="px-3 py-1 text-[11px] font-mono text-sky-400 whitespace-pre select-none"
      >
        {header}
      </td>
    </tr>
  )
})

export const DiffLineRow = memo(function DiffLineRow({ type, oldLine, newLine, content, language, hasComment }: {
  type: 'add' | 'del' | 'ctx'
  oldLine: number
  newLine: number
  content: string
  language?: string
  hasComment?: boolean
}) {
  const rowBg =
    hasComment    ? 'bg-amber-500/[0.08] hover:bg-amber-500/[0.13]' :
    type === 'add' ? 'bg-emerald-500/[0.13]' :
    type === 'del' ? 'bg-rose-500/[0.13]'    :
    'hover:bg-[var(--color-tables-table-hover)]'

  const gutterBg =
    hasComment    ? 'bg-amber-500/[0.25]' :
    type === 'add' ? 'bg-emerald-500/[0.22]' :
    type === 'del' ? 'bg-rose-500/[0.22]'    :
    'bg-[var(--color-tables-table-row-a)]'

  const prefixColor =
    type === 'add' ? 'text-emerald-400' :
    type === 'del' ? 'text-rose-400'    :
    'text-[var(--color-fonts-font-color-support)] opacity-30'

  const prefix = type === 'add' ? '+' : type === 'del' ? '−' : ' '

  const highlightedHtml = useMemo(() => {
    if (!language || !content.trim()) return null
    const grammar = Prism.languages[language]
    if (!grammar) return null
    try {
      return Prism.highlight(content, grammar, language)
    } catch {
      return null
    }
  }, [content, language])

  return (
    <tr className={`${rowBg} transition-colors`}>
      <td className={`${gutterBg} px-2 py-px text-right select-none leading-5 text-[10px] tabular-nums text-[var(--color-fonts-font-color-support)] border-r border-[var(--color-borders-border-primary)]`}>
        {type !== 'add' && oldLine > 0 ? oldLine : ''}
      </td>
      <td className={`${gutterBg} px-2 py-px text-right select-none leading-5 text-[10px] tabular-nums text-[var(--color-fonts-font-color-support)] border-r border-[var(--color-borders-border-primary)]`}>
        {type !== 'del' && newLine > 0 ? newLine : ''}
      </td>
      <td className={`${gutterBg} w-5 px-1 py-px text-center select-none leading-5 font-bold border-r border-[var(--color-borders-border-primary)] ${hasComment ? 'text-amber-400' : prefixColor}`}>
        {hasComment ? '●' : prefix !== ' ' ? prefix : ''}
      </td>
      <td className="px-3 py-px leading-5 whitespace-pre text-[13px]">
        {highlightedHtml
          ? <span dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
          : <span className="text-[var(--color-fonts-font-color-primary)]">{content}</span>
        }
      </td>
    </tr>
  )
})

export { Fragment }
export { Prism }
