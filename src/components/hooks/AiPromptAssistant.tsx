import { useState } from 'react'
import { Sparkles, MessageCircle, Copy, RotateCcw, X, Send } from 'lucide-react'
import { generatePromptTemplate } from './hookConstants'

interface Props {
  triggerTypes?: string[]
  onUse: (prompt: string) => void
  onClose: () => void
}

export function AiPromptAssistant({ triggerTypes, onUse, onClose }: Props) {
  const [mode, setMode] = useState<'template' | 'chat'>('template')
  const [templateText, setTemplateText] = useState(() =>
    generatePromptTemplate(triggerTypes?.[0] || '')
  )
  const [chatInput, setChatInput] = useState('')
  const [conversation, setConversation] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([{
    role: 'assistant',
    content: `Hi! I'm here to help you craft an automation prompt for your ${triggerTypes?.join(', ') || 'hook'}. Tell me what you'd like it to do.\n\nFor example:\n• "Update the README when code changes"\n• "Fix security vulnerabilities automatically"\n• "Sync documentation from Confluence"\n\nWhat should this hook accomplish?`,
  }])
  const [isGenerating, setIsGenerating] = useState(false)

  function switchMode(next: 'template' | 'chat') {
    setMode(next)
    if (next === 'template') {
      setTemplateText(generatePromptTemplate(triggerTypes?.[0] || ''))
    }
  }

  function sendMessage() {
    if (!chatInput.trim() || isGenerating) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setConversation(prev => [...prev, { role: 'user', content: userMsg }])
    setIsGenerating(true)
    setTimeout(() => {
      const base = generatePromptTemplate(triggerTypes?.[0] || '')
      const response = `Based on what you described, here's a customised prompt:\n\n---\n\n${base}\n\n**Specific Task**: ${userMsg}\n\n**Additional Instructions**:\n- Focus on the specific requirements you mentioned\n- Use the available tools and MCP servers as needed\n- Provide clear status updates on progress\n\n---\n\nDoes this look good, or would you like to adjust anything?`
      setConversation(prev => [...prev, { role: 'assistant', content: response }])
      setIsGenerating(false)
    }, 1400)
  }

  function handleUse() {
    if (mode === 'template') {
      onUse(templateText)
    } else {
      const last = conversation.slice().reverse().find(m => m.role === 'assistant' && m.content.includes('---'))
      onUse(last ? last.content : conversation.slice().reverse().find(m => m.role === 'assistant')?.content ?? '')
    }
    onClose()
  }

  return (
    <div className="mt-3 p-4 bg-[var(--color-cards-card-background)] border-2 border-[var(--color-buttons-button-primary)] rounded-[var(--border-radius-card)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1 p-0.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)]">
          {(['template', 'chat'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--border-radius-button-small)] text-xs font-medium transition-colors ${
                mode === m
                  ? 'bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)] shadow-sm'
                  : 'text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)]'
              }`}
            >
              {m === 'template' ? <Sparkles size={11} /> : <MessageCircle size={11} />}
              {m === 'template' ? 'Template' : 'Chat'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {mode === 'template' && (
            <>
              <button type="button" onClick={() => navigator.clipboard.writeText(templateText)} title="Copy" className="p-1.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)] transition-colors">
                <Copy size={13} />
              </button>
              <button type="button" onClick={() => setTemplateText(generatePromptTemplate(triggerTypes?.[0] || ''))} title="Regenerate" className="p-1.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)] transition-colors">
                <RotateCcw size={13} />
              </button>
            </>
          )}
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)] transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Template mode */}
      {mode === 'template' && (
        <>
          <textarea
            rows={8}
            value={templateText}
            onChange={e => setTemplateText(e.target.value)}
            className="w-full px-3 py-2 mb-3 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-xs font-mono text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] resize-none"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-xs font-medium hover:bg-[var(--color-buttons-button-back-hover)] transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleUse} className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-xs font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors">
              Use Template
            </button>
          </div>
        </>
      )}

      {/* Chat mode */}
      {mode === 'chat' && (
        <>
          <div className="mb-3 h-52 overflow-y-auto border border-[var(--color-inputs-input-border)] rounded-[var(--border-radius-small)] bg-[var(--color-inputs-input-background)]">
            <div className="p-3 space-y-3">
              {conversation.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg text-xs whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[var(--color-buttons-button-primary)] text-white ml-4'
                      : 'bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)] border border-[var(--color-cards-card-stroke)] mr-4'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="p-3 rounded-lg bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] mr-4">
                    <div className="flex items-center gap-2">
                      {[0, 0.1, 0.2].map((d, i) => (
                        <div key={i} className="w-2 h-2 bg-[var(--color-buttons-button-primary)] rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                      ))}
                      <span className="text-xs text-[var(--color-fonts-font-color-support)] ml-1">Thinking…</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Describe what you want your hook to do…"
              disabled={isGenerating}
              className="flex-1 px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!chatInput.trim() || isGenerating}
              className="px-3 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={14} />
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-xs font-medium hover:bg-[var(--color-buttons-button-back-hover)] transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleUse} disabled={conversation.length < 2} className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-xs font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Use Generated Prompt
            </button>
          </div>
        </>
      )}
    </div>
  )
}
