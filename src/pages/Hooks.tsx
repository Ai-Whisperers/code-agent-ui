import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Save, X, Power, Search, Trash2, Sparkles, Copy, RotateCcw, Send, MessageCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { AutomationHook } from '@/types/api'

// ── Trigger category helpers ──────────────────────────────────────────────────

type TriggerCategory = 'ALL' | 'SCM' | 'Jira' | 'Confluence' | 'Aikido' | 'Cron' | 'Teams' | 'Other'

const CATEGORIES: TriggerCategory[] = ['ALL', 'SCM', 'Jira', 'Confluence', 'Aikido', 'Cron', 'Teams', 'Other']

function getCategory(triggerType?: string): Exclude<TriggerCategory, 'ALL'> {
  if (!triggerType) return 'Other'
  if (triggerType === 'pr_event' || triggerType.startsWith('scm.')) return 'SCM'
  if (triggerType.startsWith('jira.')) return 'Jira'
  if (triggerType.startsWith('confluence.')) return 'Confluence'
  if (triggerType.startsWith('aikido.')) return 'Aikido'
  if (triggerType === 'cron') return 'Cron'
  if (triggerType.startsWith('teams.')) return 'Teams'
  return 'Other'
}

function getCategories(triggerTypes?: string[]): Exclude<TriggerCategory, 'ALL'>[] {
  if (!triggerTypes || triggerTypes.length === 0) return ['Other']
  const categories = triggerTypes.map(getCategory)
  return [...new Set(categories)]
}

const CATEGORY_COLORS: Record<Exclude<TriggerCategory, 'ALL'>, string> = {
  SCM:        'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Jira:       'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  Confluence: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  Aikido:     'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  Cron:       'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Teams:      'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  Other:      'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
}

// ── AI Prompt Templates ──────────────────────────────────────────────────────

const PROMPT_TEMPLATES = {
  base: `You are an AI code assistant helping with repository maintenance and automation tasks. When this automation hook triggers, you have access to the following tools and capabilities:

## Available Tools & MCP Servers

### Code Analysis & Modification
- **File Operations**: Read, write, edit, and delete files in the repository
- **Code Search**: Search across the codebase using patterns and filters
- **Git Operations**: Commit changes, create branches, manage pull requests
- **Dependency Management**: Update package.json, pom.xml, requirements.txt, etc.

### Documentation & Knowledge
- **README Updates**: Automatically update project documentation
- **API Documentation**: Generate and maintain API docs from code
- **Changelog Generation**: Create release notes from commit history
- **Code Comments**: Add inline documentation and JSDoc/JavaDoc comments

### Quality & Security
- **Code Linting**: Fix ESLint, Prettier, and other linting issues
- **Security Scanning**: Address security vulnerabilities in dependencies
- **Test Generation**: Create unit tests and integration tests
- **Code Refactoring**: Improve code structure and maintainability

### Integration Servers (MCP)
- **Jira Integration**: Access issue details, update status, add comments
- **Confluence Integration**: Read/write documentation pages, sync content
- **Slack/Teams Integration**: Send notifications and status updates
- **Database Access**: Query and update application databases when needed
- **CI/CD Integration**: Trigger builds, access deployment status

## Context Information
The following context will be automatically injected into your prompt:
{CONTEXT_INFO}

## Your Task
`,

  scm: `Update the repository based on the pull request event. Common tasks include:
- Update README.md with new features or API changes
- Sync documentation with code changes
- Run automated code quality checks
- Update dependency versions
- Generate changelog entries`,

  jira: `Process the Jira issue and take appropriate action. Common tasks include:
- Fix bugs described in the issue
- Implement new features as specified
- Update documentation related to the issue
- Add automated tests for the changes
- Comment back on the Jira issue with progress updates`,

  confluence: `Sync repository content with the Confluence page changes. Common tasks include:
- Update README or docs based on Confluence changes
- Sync API documentation from Confluence specs
- Update configuration files based on documentation
- Validate that code matches the documented specifications`,

  aikido: `Address the security vulnerability detected by Aikido. Common tasks include:
- Update vulnerable dependencies to secure versions
- Apply security patches to affected code
- Add security tests to prevent regression
- Update security documentation and guidelines
- Review and fix related security issues`,

  cron: `Perform scheduled maintenance tasks. Common tasks include:
- Update dependencies to latest versions
- Clean up deprecated code and dependencies
- Regenerate auto-generated files
- Run periodic security scans
- Update documentation and changelogs
- Sync external data sources`,

  teams: `Respond to the Teams message or activity. Common tasks include:
- Process commands or requests from team members
- Update project status based on team discussions
- Create issues or tasks based on team feedback
- Generate reports requested by the team
- Deploy changes or perform maintenance as requested`,
}

function generatePromptTemplate(triggerType?: string): string {
  const baseTemplate = PROMPT_TEMPLATES.base
  
  // Add trigger-specific guidance
  let specificGuidance = ''
  if (triggerType?.startsWith('scm.')) {
    specificGuidance = PROMPT_TEMPLATES.scm
  } else if (triggerType?.startsWith('jira.')) {
    specificGuidance = PROMPT_TEMPLATES.jira
  } else if (triggerType?.startsWith('confluence.')) {
    specificGuidance = PROMPT_TEMPLATES.confluence
  } else if (triggerType?.startsWith('aikido.')) {
    specificGuidance = PROMPT_TEMPLATES.aikido
  } else if (triggerType === 'cron') {
    specificGuidance = PROMPT_TEMPLATES.cron
  } else if (triggerType?.startsWith('teams.')) {
    specificGuidance = PROMPT_TEMPLATES.teams
  } else {
    specificGuidance = 'Analyze the trigger context and determine the appropriate action to take.'
  }

  return baseTemplate + specificGuidance
}

function subTriggerLabel(hook: AutomationHook): string | null {
  if (hook.cronExpr) return `⏱ ${hook.cronExpr}`
  if (hook.prEvent) {
    const branch = hook.branchPattern ? ` · ${hook.branchPattern}` : ''
    return `${hook.prEvent}${branch}`
  }
  if (hook.triggerTypes && hook.triggerTypes.length > 0) {
    const nonPrTriggers = hook.triggerTypes.filter(t => t !== 'pr_event')
    if (nonPrTriggers.length > 0) {
      return nonPrTriggers.join(', ')
    }
  }
  return null
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HooksPage() {
  const qc = useQueryClient()
  const [editingHook, setEditingHook] = useState<AutomationHook | null>(null)
  const [showHookDialog, setShowHookDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<TriggerCategory>('ALL')

  const { data: hooks, isLoading } = useQuery<AutomationHook[]>({
    queryKey: ['hooks'],
    queryFn: () => api.get('/settings/hooks').then((r) => r.data).catch(() => []),
  })

  const saveMutation = useMutation({
    mutationFn: (hook: AutomationHook) =>
      api.put(`/settings/hooks/${hook.name}`, hook),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hooks'] })
      setEditingHook(null)
      setShowHookDialog(false)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      api.patch(`/settings/hooks/${name}/${enabled ? 'enable' : 'disable'}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hooks'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.delete(`/settings/hooks/${name}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hooks'] }),
  })

  const allHooks = Array.isArray(hooks) ? hooks : []

  const filtered = allHooks.filter((h) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.description ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory =
      categoryFilter === 'ALL' || getCategories(h.triggerTypes).includes(categoryFilter)
    return matchesSearch && matchesCategory
  })

  const openHookDialog = (hook: AutomationHook) => {
    setEditingHook(hook)
    setShowHookDialog(true)
  }

  return (
    <main>
      <PageHeader
        title="Automation Hooks"
        subtitle="Configure event-driven automation triggers."
        actions={
          <button
            onClick={() => openHookDialog({ name: '', enabled: false })}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
          >
            <Plus size={15} />
            New Hook
          </button>
        }
      />

      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fonts-font-color-support)] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search hooks…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] placeholder:text-[var(--color-fonts-font-color-support)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                categoryFilter === cat
                  ? 'bg-[var(--color-filters-filter-active)] text-[var(--color-fonts-font-color-buttons)]'
                  : 'bg-[var(--color-filters-filter-background)] text-[var(--color-fonts-font-color-support)] hover:bg-[var(--color-filters-filter-hover)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Hook list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))
        ) : allHooks.length === 0 ? (
          <div className="text-center py-10 text-[var(--color-fonts-font-color-support)]">
            No hooks configured yet.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-[var(--color-fonts-font-color-support)]">
            No hooks match your search.
          </div>
        ) : (
          filtered.map((hook) => (
            <HookCard
              key={hook.name}
              hook={hook}
              onEdit={() => openHookDialog(hook)}
              onToggle={() => toggleMutation.mutate({ name: hook.name, enabled: !hook.enabled })}
              onDelete={() => deleteMutation.mutate(hook.name)}
              isToggling={toggleMutation.isPending}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === hook.name}
            />
          ))
        )}
      </div>

      {/* Hook Editor Modal Dialog */}
      {showHookDialog && editingHook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => {
              setShowHookDialog(false)
              setEditingHook(null)
            }}
          />
          
          {/* Modal Content */}
          <div className="relative bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <HookEditor
              hook={editingHook}
              onSave={(h) => saveMutation.mutate(h)}
              onCancel={() => {
                setShowHookDialog(false)
                setEditingHook(null)
              }}
              isSaving={saveMutation.isPending}
            />
          </div>
        </div>
      )}
    </main>
  )
}

// ── Hook card ─────────────────────────────────────────────────────────────────

function HookCard({
  hook,
  onEdit,
  onToggle,
  onDelete,
  isToggling,
  isDeleting,
}: {
  hook: AutomationHook
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  isToggling: boolean
  isDeleting: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const categories = getCategories(hook.triggerTypes)
  const subLabel = subTriggerLabel(hook)

  function handleDeleteClick() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    } else {
      onDelete()
    }
  }

  return (
    <div className="flex items-center justify-between bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] px-5 py-4 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      <div className="flex items-start gap-3 min-w-0">
        {/* Trigger category badges */}
        <div className="flex flex-wrap gap-1 mt-0.5 shrink-0">
          {categories.map((category) => (
            <span
              key={category}
              className={`inline-flex items-center px-2 py-0.5 rounded-[var(--border-radius-tag)] text-xs font-semibold ${CATEGORY_COLORS[category]}`}
            >
              {category}
            </span>
          ))}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-fonts-font-color-primary)] truncate">
            {hook.name}
          </p>
          {hook.description && (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5 truncate">
              {hook.description}
            </p>
          )}
          {subLabel && (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5 font-mono opacity-70">
              {subLabel}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        {/* Enable / disable */}
        <button
          onClick={onToggle}
          disabled={isToggling}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--border-radius-button-small)] text-xs font-medium transition-colors disabled:opacity-60 ${
            hook.enabled
              ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)] hover:opacity-80'
              : 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)] hover:opacity-80'
          }`}
        >
          <Power size={12} />
          {hook.enabled ? 'Enabled' : 'Disabled'}
        </button>

        {/* Edit */}
        <button
          onClick={onEdit}
          className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-xs font-medium hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
        >
          Edit
        </button>

        {/* Delete (two-click confirmation) */}
        <button
          onClick={handleDeleteClick}
          disabled={isDeleting}
          title={confirmDelete ? 'Click again to confirm deletion' : 'Delete hook'}
          className={`p-1.5 rounded-[var(--border-radius-button-small)] transition-colors disabled:opacity-60 ${
            confirmDelete
              ? 'bg-[var(--color-status-critical-background)] text-[var(--color-status-border-critical)]'
              : 'text-[var(--color-icons-icon)] hover:bg-[var(--color-status-critical-background)] hover:text-[var(--color-status-border-critical)]'
          }`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Hook editor ───────────────────────────────────────────────────────────────

const TRIGGER_OPTIONS = [
  { category: 'SCM', triggers: [
    { value: 'scm.pr_created', label: 'PR Created', description: 'When a pull request is created' },
    { value: 'scm.pr_updated', label: 'PR Updated', description: 'When a pull request is updated' },
    { value: 'scm.pr_merged', label: 'PR Merged', description: 'When a pull request is merged' },
    { value: 'pr_event', label: 'PR Event (Legacy)', description: 'Legacy PR event trigger' },
  ]},
  { category: 'Jira', triggers: [
    { value: 'jira.issue_created', label: 'Issue Created', description: 'When a Jira issue is created' },
    { value: 'jira.issue_updated', label: 'Issue Updated', description: 'When a Jira issue is updated' },
    { value: 'jira.issue_assigned', label: 'Issue Assigned', description: 'When a Jira issue is assigned' },
  ]},
  { category: 'Confluence', triggers: [
    { value: 'confluence.page_created', label: 'Page Created', description: 'When a Confluence page is created' },
    { value: 'confluence.page_updated', label: 'Page Updated', description: 'When a Confluence page is updated' },
  ]},
  { category: 'Aikido', triggers: [
    { value: 'aikido.vulnerability_new', label: 'New Vulnerability', description: 'When a new vulnerability is detected' },
    { value: 'aikido.vulnerability_fixed', label: 'Vulnerability Fixed', description: 'When a vulnerability is resolved' },
  ]},
  { category: 'Schedule', triggers: [
    { value: 'cron', label: 'Cron Schedule', description: 'Run on a schedule using cron expressions' },
  ]},
  { category: 'Teams', triggers: [
    { value: 'teams.message', label: 'Teams Message', description: 'When a Teams message/mention occurs' },
  ]},
]

function HookEditor({
  hook,
  onSave,
  onCancel,
  isSaving,
}: {
  hook: AutomationHook
  onSave: (h: AutomationHook) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [form, setForm] = useState<AutomationHook>(hook)
  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (form.triggerTypes && form.triggerTypes.length > 0) {
      const option = TRIGGER_OPTIONS.find(opt => 
        opt.triggers.some(t => form.triggerTypes?.includes(t.value))
      )
      return option?.category || 'SCM'
    }
    return 'SCM'
  })
  const [showPromptTemplate, setShowPromptTemplate] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [chatMode, setChatMode] = useState<'template' | 'chat'>('template')
  const [chatInput, setChatInput] = useState('')
  const [conversation, setConversation] = useState<Array<{role: 'user' | 'assistant', content: string}>>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const currentCategoryTriggers = TRIGGER_OPTIONS.find(opt => opt.category === selectedCategory)?.triggers || []
  const needsRepoUrl = form.triggerTypes?.some(t => ['scm.pr_created', 'scm.pr_updated', 'scm.pr_merged', 'pr_event'].includes(t)) || false
  const needsCronExpr = form.triggerTypes?.includes('cron') || false
  const needsPrEvent = form.triggerTypes?.includes('pr_event') || false

  const generateTemplate = () => {
    const primaryTrigger = form.triggerTypes?.[0] || ''
    const template = generatePromptTemplate(primaryTrigger)
    setCustomPrompt(template)
    setShowPromptTemplate(true)
    setChatMode('template')
  }

  const startChat = () => {
    setShowPromptTemplate(true)
    setChatMode('chat')
    setConversation([
      {
        role: 'assistant',
        content: `Hi! I'm here to help you create a great automation prompt for your ${form.triggerTypes?.join(', ') || 'hook'}. Tell me what you'd like this hook to do when it triggers. For example:

• "Update the README when code changes"
• "Fix security vulnerabilities automatically" 
• "Sync documentation from Confluence"
• "Run tests and update dependencies"

What would you like your hook to accomplish?`
      }
    ])
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isGenerating) return
    
    const userMessage = chatInput.trim()
    setChatInput('')
    setConversation(prev => [...prev, { role: 'user', content: userMessage }])
    setIsGenerating(true)

    // Simulate AI response generation
    setTimeout(() => {
      const aiResponse = generateAIResponse(userMessage, form.triggerTypes)
      setConversation(prev => [...prev, { role: 'assistant', content: aiResponse }])
      setIsGenerating(false)
    }, 1500)
  }

  const generateAIResponse = (userMessage: string, triggerTypes?: string[]) => {
    // Simple AI response simulation - in real implementation this would call your AI service
    const primaryTrigger = triggerTypes?.[0] || ''
    const baseTemplate = generatePromptTemplate(primaryTrigger)
    
    return `Based on what you described, here's a customized prompt for your ${triggerTypes?.join(', ') || 'automation hook'}:

---

${baseTemplate}

**Specific Task**: ${userMessage}

**Additional Instructions**:
- Focus on the specific requirements you mentioned
- Use the available tools and MCP servers as needed
- Provide clear status updates on progress
- Follow best practices for code quality and security

---

Does this look good, or would you like me to adjust anything? You can copy this to your hook or ask me to modify it.`
  }

  const useGeneratedPrompt = () => {
    // Get the last assistant message that contains a prompt
    const lastAssistantMessage = conversation.slice().reverse().find(msg => 
      msg.role === 'assistant' && msg.content.includes('---')
    )
    
    if (lastAssistantMessage) {
      setForm(p => ({ ...p, prompt: lastAssistantMessage.content }))
    } else if (customPrompt) {
      setForm(p => ({ ...p, prompt: customPrompt }))
    }
    
    setShowPromptTemplate(false)
    setConversation([])
    setCustomPrompt('')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="mb-6 bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-6 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">{form.name || 'New Hook'}</h3>
        <button
          onClick={onCancel}
          className="p-1 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] border-b border-[var(--color-cards-card-stroke)] pb-2">
            Basic Information
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
                Hook Name
              </label>
              <input
                type="text"
                value={form.name ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. update-docs-on-merge"
                className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
                Description
              </label>
              <input
                type="text"
                value={form.description ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of what this hook does"
                className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Trigger Configuration */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] border-b border-[var(--color-cards-card-stroke)] pb-2">
            Trigger Configuration
          </h4>

          {/* Category Selection */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-2 uppercase tracking-wide">
              Trigger Category
            </label>
            <div className="flex flex-wrap gap-2">
              {TRIGGER_OPTIONS.map((opt) => (
                <button
                  key={opt.category}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(opt.category)
                    // Clear trigger types when switching categories
                    setForm(p => ({ ...p, triggerTypes: [] }))
                  }}
                  className={`px-3 py-2 rounded-[var(--border-radius-button-small)] text-sm font-medium transition-colors ${
                    selectedCategory === opt.category
                      ? 'bg-[var(--color-buttons-button-primary)] text-white'
                      : 'bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)]'
                  }`}
                >
                  {opt.category}
                </button>
              ))}
            </div>
          </div>

          {/* Specific Trigger */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-2 uppercase tracking-wide">
              Specific Trigger
            </label>
            <div className="space-y-2">
              {currentCategoryTriggers.map((trigger) => (
                <label key={trigger.value} className="flex items-start gap-3 p-3 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] hover:bg-[var(--color-cards-card-background)] cursor-pointer">
                  <input
                    type="checkbox"
                    value={trigger.value}
                    checked={form.triggerTypes?.includes(trigger.value) || false}
                    onChange={(e) => {
                      const { value, checked } = e.target
                      setForm(p => ({
                        ...p,
                        triggerTypes: checked
                          ? [...(p.triggerTypes || []), value]
                          : (p.triggerTypes || []).filter(t => t !== value)
                      }))
                    }}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
                      {trigger.label}
                    </div>
                    <div className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
                      {trigger.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Dynamic trigger-specific fields */}
          {needsPrEvent && (
            <div>
              <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
                PR Event
              </label>
              <select
                value={form.prEvent ?? ''}
                onChange={(e) => setForm(p => ({ ...p, prEvent: e.target.value }))}
                className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
              >
                <option value="">Select PR event...</option>
                <option value="pullrequest:created">PR Created</option>
                <option value="pullrequest:updated">PR Updated</option>
                <option value="pullrequest:fulfilled">PR Merged</option>
              </select>
            </div>
          )}

          {needsCronExpr && (
            <div>
              <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
                Cron Expression
              </label>
              <input
                type="text"
                value={form.cronExpr ?? ''}
                onChange={(e) => setForm(p => ({ ...p, cronExpr: e.target.value }))}
                placeholder="0 8 * * * (daily at 8am)"
                className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
              />
              <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
                Format: minute hour dayOfMonth month dayOfWeek (e.g., "0 8 * * *" for daily at 8am)
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
              Branch Pattern (optional)
            </label>
            <input
              type="text"
              value={form.branchPattern ?? ''}
              onChange={(e) => setForm(p => ({ ...p, branchPattern: e.target.value }))}
              placeholder="^(main|develop)$ (regex pattern)"
              className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
            />
          </div>
        </div>

        {/* Action Configuration */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] border-b border-[var(--color-cards-card-stroke)] pb-2">
            Action Configuration
          </h4>

          {needsRepoUrl && (
            <div>
              <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
                Repository URL (optional)
              </label>
              <input
                type="text"
                value={form.repoUrl ?? ''}
                onChange={(e) => setForm(p => ({ ...p, repoUrl: e.target.value }))}
                placeholder="https://github.com/owner/repo.git (leave empty to use trigger repo)"
                className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] mb-1.5 uppercase tracking-wide">
              Target Branch
            </label>
            <input
              type="text"
              value={form.targetBranch ?? ''}
              onChange={(e) => setForm(p => ({ ...p, targetBranch: e.target.value }))}
              placeholder="develop (default branch for changes)"
              className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[var(--color-fonts-font-color-input-label)] uppercase tracking-wide">
                AI Prompt
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={generateTemplate}
                  disabled={!form.triggerTypes?.length}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Sparkles size={12} />
                  Template
                </button>
                <button
                  type="button"
                  onClick={startChat}
                  disabled={!form.triggerTypes?.length}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <MessageCircle size={12} />
                  Chat
                </button>
              </div>
            </div>
            
            <div className="relative">
              <textarea
                rows={6}
                value={form.prompt ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
                placeholder="Describe what the AI should do when this hook triggers... Click 'AI Help' for suggestions!"
                className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] resize-none"
              />
            </div>

            {/* AI Prompt Assistant Modal/Panel */}
            {showPromptTemplate && (
              <div className="mt-3 p-4 bg-[var(--color-cards-card-background)] border-2 border-[var(--color-buttons-button-primary)] rounded-[var(--border-radius-card)] shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {chatMode === 'chat' ? (
                      <MessageCircle size={16} className="text-[var(--color-buttons-button-primary)]" />
                    ) : (
                      <Sparkles size={16} className="text-[var(--color-buttons-button-primary)]" />
                    )}
                    <h5 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
                      {chatMode === 'chat' ? 'AI Prompt Assistant' : 'AI-Generated Prompt Template'}
                    </h5>
                  </div>
                  <div className="flex items-center gap-2">
                    {chatMode === 'template' && (
                      <>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(customPrompt)}
                          className="p-1.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)] transition-colors"
                          title="Copy to clipboard"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={generateTemplate}
                          className="p-1.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)] transition-colors"
                          title="Regenerate template"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowPromptTemplate(false)
                        setConversation([])
                        setCustomPrompt('')
                        setChatInput('')
                      }}
                      className="p-1.5 rounded hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-icons-icon)] transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {chatMode === 'template' ? (
                  /* Template Mode */
                  <>
                    <div className="mb-3">
                      <textarea
                        rows={8}
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        className="w-full px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-xs text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] font-mono resize-none"
                        placeholder="AI-generated prompt will appear here..."
                      />
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-xs text-[var(--color-fonts-font-color-support)]">
                        This template includes guidance on available tools and MCP servers. You can edit it before using.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowPromptTemplate(false)}
                          className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-xs font-medium hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={useGeneratedPrompt}
                          className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-xs font-medium hover:bg-[var(--color-buttons-button-primary-hover)] transition-colors"
                        >
                          Use Template
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Chat Mode */
                  <>
                    {/* Conversation Display */}
                    <div className="mb-4 h-64 overflow-y-auto border border-[var(--color-inputs-input-border)] rounded-[var(--border-radius-small)] bg-[var(--color-inputs-input-background)]">
                      <div className="p-3 space-y-3">
                        {conversation.map((message, index) => (
                          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg text-xs whitespace-pre-wrap ${
                              message.role === 'user' 
                                ? 'bg-[var(--color-buttons-button-primary)] text-white ml-4'
                                : 'bg-[var(--color-cards-card-background)] text-[var(--color-fonts-font-color-primary)] border border-[var(--color-cards-card-stroke)] mr-4'
                            }`}>
                              {message.content}
                            </div>
                          </div>
                        ))}
                        
                        {isGenerating && (
                          <div className="flex justify-start">
                            <div className="max-w-[80%] p-3 rounded-lg text-xs bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] mr-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-[var(--color-buttons-button-primary)] rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-[var(--color-buttons-button-primary)] rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                <div className="w-2 h-2 bg-[var(--color-buttons-button-primary)] rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                <span className="text-[var(--color-fonts-font-color-support)] ml-2">AI is thinking...</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Chat Input */}
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                        placeholder="Describe what you want your hook to do..."
                        className="flex-1 px-3 py-2 rounded-[var(--border-radius-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-user-input)] focus:outline-none focus:border-[var(--color-buttons-button-primary)]"
                        disabled={isGenerating}
                      />
                      <button
                        type="button"
                        onClick={sendChatMessage}
                        disabled={!chatInput.trim() || isGenerating}
                        className="px-3 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send size={14} />
                      </button>
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="text-xs text-[var(--color-fonts-font-color-support)]">
                        Chat with AI to create a custom prompt. It will guide you through the process.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowPromptTemplate(false)}
                          className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-xs font-medium hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={useGeneratedPrompt}
                          disabled={conversation.length === 0}
                          className="px-3 py-1.5 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-xs font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Use Generated Prompt
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="commitDirect"
              checked={form.commitDirect ?? false}
              onChange={(e) => setForm(p => ({ ...p, commitDirect: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="commitDirect" className="text-sm text-[var(--color-fonts-font-color-primary)]">
              Commit directly (skip PR creation)
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-6 pt-4 border-t border-[var(--color-cards-card-stroke)]">
        <button
          onClick={() => onSave(form)}
          disabled={isSaving || !form.name || !form.triggerTypes?.length || !form.prompt}
          className="flex items-center gap-2 px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-primary)] text-white text-sm font-medium hover:bg-[var(--color-buttons-button-primary-hover)] disabled:opacity-60 transition-colors"
        >
          <Save size={14} />
          {isSaving ? 'Saving…' : 'Save Hook'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-[var(--border-radius-button-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] text-sm font-medium hover:bg-[var(--color-buttons-button-back-hover)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
