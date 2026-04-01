import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import {
  Bold, Italic, Strikethrough,
  List, ListOrdered,
  Quote, Code, CodeSquare,
  Link as LinkIcon,
  Minus,
  ChevronDown,
} from 'lucide-react'

// ── Toolbar ───────────────────────────────────────────────────────────────────

interface ToolbarBtnProps {
  active?: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}

function ToolbarBtn({ active, title, onClick, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={[
        'flex items-center justify-center w-6 h-6 rounded text-[12px] transition-colors',
        active
          ? 'bg-[var(--color-buttons-button-primary)] text-white'
          : 'text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-tables-table-hover)]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-[var(--color-borders-border-primary)] opacity-60 shrink-0 mx-0.5" />
}

// ── Text type dropdown ────────────────────────────────────────────────────────

function TextTypeSelect({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const label = editor?.isActive('heading', { level: 1 }) ? 'Heading 1'
    : editor?.isActive('heading', { level: 2 }) ? 'Heading 2'
    : editor?.isActive('heading', { level: 3 }) ? 'Heading 3'
    : 'Normal text'

  const options = [
    { label: 'Normal text', action: () => editor?.chain().focus().setParagraph().run(), active: !editor?.isActive('heading') },
    { label: 'Heading 1',   action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), active: editor?.isActive('heading', { level: 1 }) },
    { label: 'Heading 2',   action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive('heading', { level: 2 }) },
    { label: 'Heading 3',   action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), active: editor?.isActive('heading', { level: 3 }) },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v) }}
        className="flex items-center gap-1 px-2 h-6 rounded text-[11px] font-medium text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-tables-table-hover)] transition-colors whitespace-nowrap"
      >
        {label} <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 rounded border border-[var(--color-borders-border-primary)] bg-[var(--color-cards-card-background)] shadow-lg overflow-hidden py-0.5 min-w-[130px]">
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); opt.action(); setOpen(false) }}
              className={[
                'w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--color-tables-table-hover)]',
                opt.active
                  ? 'text-[var(--color-buttons-button-primary)] font-semibold'
                  : 'text-[var(--color-fonts-font-color-primary)]',
                opt.label === 'Heading 1' ? 'font-bold text-sm' : '',
                opt.label === 'Heading 2' ? 'font-semibold' : '',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export interface RichTextEditorProps {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  disabled?: boolean
  minHeight?: number
  maxHeight?: number
  /** When true the editor stretches to fill its parent (ignores minHeight/maxHeight). */
  fill?: boolean
  className?: string
  highlight?: boolean
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start writing…',
  disabled = false,
  minHeight = 200,
  maxHeight,
  fill = false,
  className = '',
  highlight = false,
}: RichTextEditorProps) {
  const lastExternalRef  = useRef(value)
  // Set to true while we are calling setContent ourselves so onUpdate doesn't echo the change back
  const isExternalSyncRef = useRef(false)

  // Stable extensions array — must not change between renders or useEditor recreates the editor
  // tiptap-markdown already bundles its own `link` extension, so we must NOT add Link separately
  const extensions = useMemo(
    () => [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    // placeholder rarely changes; if it does we intentionally accept the re-init
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: { class: 'adf-editor-content outline-none' },
    },
    onUpdate({ editor: e }) {
      // Skip echo-back when we triggered the content change ourselves
      if (isExternalSyncRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md: string = (e.storage as any).markdown?.getMarkdown?.() ?? ''
      // Guard: if the markdown hasn't actually changed, don't call onChange —
      // this prevents the normalize-then-loop cycle where tiptap-markdown produces
      // a slightly different string than the raw `value` prop on every setContent call
      if (md === lastExternalRef.current) return
      lastExternalRef.current = md
      onChange(md)
    },
  })

  // Sync external changes (e.g. AI updates or tab switching) into the editor.
  // We rely solely on value vs lastExternalRef to decide whether a sync is needed.
  useEffect(() => {
    if (!editor) return
    if (value === lastExternalRef.current) return
    isExternalSyncRef.current = true
    editor.commands.setContent(value)
    // Keep flag true until after any synchronous transaction handlers fire,
    // then clear it in a microtask so deferred onUpdate callbacks are also covered
    queueMicrotask(() => { isExternalSyncRef.current = false })
    lastExternalRef.current = value
  }, [value, editor])

  // Toggle editable when disabled prop changes
  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [disabled, editor])

  const addLink = () => {
    const prev = editor?.getAttributes('link').href ?? ''
    const url = window.prompt('URL', prev)
    if (url === null) return
    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  return (
    <div
      className={[
        'adf-editor rounded border transition-all duration-300',
        fill ? 'flex flex-col h-full' : '',
        highlight
          ? 'ring-2 ring-[var(--color-buttons-button-primary)]/50 border-[var(--color-buttons-button-primary)]'
          : 'border-[var(--color-cards-card-stroke)]',
        !disabled ? 'hover:border-[var(--color-buttons-button-primary)] focus-within:border-[var(--color-buttons-button-primary)] focus-within:ring-1 focus-within:ring-[var(--color-buttons-button-primary)]/20' : 'opacity-60',
        className,
      ].join(' ')}
    >
      {/* Toolbar — hidden when read-only */}
      {!disabled && (
        <>
          <div className="flex items-center gap-0.5 px-2 py-1.5 bg-[var(--color-cards-card-background-hover)] flex-wrap">
            <TextTypeSelect editor={editor} />
            <ToolbarDivider />
            <ToolbarBtn title="Bold (⌘B)" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
              <Bold size={13} strokeWidth={2.5} />
            </ToolbarBtn>
            <ToolbarBtn title="Italic (⌘I)" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
              <Italic size={13} />
            </ToolbarBtn>
            <ToolbarBtn title="Strikethrough" active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}>
              <Strikethrough size={13} />
            </ToolbarBtn>
            <ToolbarDivider />
            <ToolbarBtn title="Bullet list" active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
              <List size={13} />
            </ToolbarBtn>
            <ToolbarBtn title="Numbered list" active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
              <ListOrdered size={13} />
            </ToolbarBtn>
            <ToolbarDivider />
            <ToolbarBtn title="Blockquote" active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
              <Quote size={13} />
            </ToolbarBtn>
            <ToolbarBtn title="Code block" active={editor?.isActive('codeBlock')} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
              <CodeSquare size={13} />
            </ToolbarBtn>
            <ToolbarBtn title="Inline code" active={editor?.isActive('code')} onClick={() => editor?.chain().focus().toggleCode().run()}>
              <Code size={13} />
            </ToolbarBtn>
            <ToolbarDivider />
            <ToolbarBtn title="Link" active={editor?.isActive('link')} onClick={addLink}>
              <LinkIcon size={13} />
            </ToolbarBtn>
            <ToolbarBtn title="Horizontal rule" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
              <Minus size={13} />
            </ToolbarBtn>
          </div>
          <div className="h-px bg-[var(--color-borders-border-primary)] opacity-60" />
        </>
      )}

      {/* Editor content */}
      <div
        className={fill ? 'h-full overflow-y-auto' : ''}
        style={fill ? undefined : { minHeight, ...(maxHeight ? { maxHeight, overflowY: 'auto' } : {}) }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
