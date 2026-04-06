import { useState, useCallback } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'

export function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [code])

  return (
    <div className="my-3 rounded-[var(--border-radius-card)] overflow-hidden text-sm">
      <div className="flex items-center px-4 py-1.5 bg-[#282c34] border-b border-white/10">
        <span className="text-xs font-mono text-[#abb2bf] uppercase tracking-wider flex-1">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[#abb2bf] hover:text-white transition-colors"
          title="Copy code"
        >
          {copied
            ? <Check size={13} className="text-green-400" />
            : <Copy size={13} />}
          <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
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
}
