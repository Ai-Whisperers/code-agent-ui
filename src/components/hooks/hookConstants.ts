import type { FC } from 'react'
import { Sparkles, Play, Database, BookOpen, Zap, Users, Share2 } from 'lucide-react'
import type { AutomationHook } from '@/types/api'

// ── Trigger category ───────────────────────────────────────────────────────

export type TriggerCategory = 'ALL' | 'SCM' | 'Jira' | 'Confluence' | 'Aikido' | 'Cron' | 'Teams' | 'Quality' | 'Other'

export const CATEGORIES: TriggerCategory[] = [
  'ALL', 'SCM', 'Jira', 'Confluence', 'Aikido', 'Cron', 'Teams', 'Quality', 'Other',
]

export const TRIGGER_OPTIONS = [
  { category: 'SCM', triggers: [
    { value: 'scm.pr_created', label: 'PR Created',       description: 'When a pull request is created' },
    { value: 'scm.pr_updated', label: 'PR Updated',       description: 'When a pull request is updated' },
    { value: 'scm.pr_merged',  label: 'PR Merged',        description: 'When a pull request is merged' },
    { value: 'pr_event',       label: 'PR Event (Legacy)', description: 'Legacy PR event trigger' },
  ]},
  { category: 'Jira', triggers: [
    { value: 'jira.issue_created',  label: 'Issue Created',  description: 'When a Jira issue is created' },
    { value: 'jira.issue_updated',  label: 'Issue Updated',  description: 'When a Jira issue is updated' },
    { value: 'jira.issue_assigned', label: 'Issue Assigned', description: 'When a Jira issue is assigned' },
  ]},
  { category: 'Confluence', triggers: [
    { value: 'confluence.page_created', label: 'Page Created', description: 'When a Confluence page is created' },
    { value: 'confluence.page_updated', label: 'Page Updated', description: 'When a Confluence page is updated' },
  ]},
  { category: 'Aikido', triggers: [
    { value: 'aikido.vulnerability_new',   label: 'New Vulnerability',   description: 'When a new vulnerability is detected' },
    { value: 'aikido.vulnerability_fixed', label: 'Vulnerability Fixed', description: 'When a vulnerability is resolved' },
  ]},
  { category: 'Schedule', triggers: [
    { value: 'cron', label: 'Cron Schedule', description: 'Run on a schedule using cron expressions' },
  ]},
  { category: 'Teams', triggers: [
    { value: 'teams.message', label: 'Teams Message', description: 'When a Teams message/mention occurs' },
  ]},
  { category: 'Quality', triggers: [
    { value: 'quality.report_generated', label: 'Report Generated', description: 'When a quality report is generated for a repository' },
  ]},
]

export const CATEGORY_COLORS: Record<Exclude<TriggerCategory, 'ALL'>, string> = {
  SCM:        'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Jira:       'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  Confluence: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  Aikido:     'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  Cron:       'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Teams:      'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  Quality:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Other:      'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
}

// ── Target action types ────────────────────────────────────────────────────

export type ActionTypeDef = {
  id: string
  label: string
  description: string
  icon: FC<{ size?: number; className?: string }>
}

export const ACTION_TYPES: ActionTypeDef[] = [
  { id: 'ai_prompt',       label: 'AI Prompt',              description: 'Run AI with a custom prompt',             icon: Sparkles },
  { id: 'execute_job',     label: 'Execute Job',            description: 'Trigger a CI/CD job or pipeline',         icon: Play },
  { id: 'code_embeddings', label: 'Code Embeddings',        description: 'Update code embeddings index',            icon: Database },
  { id: 'codegraph',       label: 'Code Graph',             description: 'Refresh the code knowledge graph',        icon: Share2 },
  { id: 'generate_docs',   label: 'Generate Documentation', description: 'Auto-generate repository documentation',  icon: BookOpen },
  { id: 'n8n_event',       label: 'n8n Event',              description: 'Trigger an n8n workflow event',           icon: Zap },
  { id: 'teams_event',     label: 'Teams Event',            description: 'Send a Microsoft Teams notification',     icon: Users },
]

// ── Prompt templates ───────────────────────────────────────────────────────

export const PROMPT_TEMPLATES = {
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
  quality: `Respond to the quality report results. Common tasks include:
- Identify and fix areas with low unit test coverage
- Refactor high-complexity methods flagged by the report
- Open Jira issues for quality improvements below threshold
- Notify the team about score regressions via Teams or Slack
- Trigger automated test generation for under-covered modules`,
}

// ── Pure helper functions ──────────────────────────────────────────────────

export function getCategory(triggerType?: string): Exclude<TriggerCategory, 'ALL'> {
  if (!triggerType) return 'Other'
  if (triggerType === 'pr_event' || triggerType.startsWith('scm.')) return 'SCM'
  if (triggerType.startsWith('jira.')) return 'Jira'
  if (triggerType.startsWith('confluence.')) return 'Confluence'
  if (triggerType.startsWith('aikido.')) return 'Aikido'
  if (triggerType === 'cron') return 'Cron'
  if (triggerType.startsWith('teams.')) return 'Teams'
  if (triggerType.startsWith('quality.')) return 'Quality'
  return 'Other'
}

export function getCategories(triggerTypes?: string[]): Exclude<TriggerCategory, 'ALL'>[] {
  if (!triggerTypes || triggerTypes.length === 0) return ['Other']
  return [...new Set(triggerTypes.map(getCategory))]
}

export function getTriggerLabel(value: string): string {
  for (const opt of TRIGGER_OPTIONS) {
    const t = opt.triggers.find(t => t.value === value)
    if (t) return t.label
  }
  return value
}

export function generatePromptTemplate(triggerType?: string): string {
  let specific = 'Analyze the trigger context and determine the appropriate action to take.'
  if (triggerType?.startsWith('scm.'))         specific = PROMPT_TEMPLATES.scm
  else if (triggerType?.startsWith('jira.'))   specific = PROMPT_TEMPLATES.jira
  else if (triggerType?.startsWith('confluence.')) specific = PROMPT_TEMPLATES.confluence
  else if (triggerType?.startsWith('aikido.')) specific = PROMPT_TEMPLATES.aikido
  else if (triggerType === 'cron')             specific = PROMPT_TEMPLATES.cron
  else if (triggerType?.startsWith('teams.'))   specific = PROMPT_TEMPLATES.teams
  else if (triggerType?.startsWith('quality.')) specific = PROMPT_TEMPLATES.quality
  return PROMPT_TEMPLATES.base + specific
}

export function subTriggerLabel(hook: AutomationHook): string | null {
  if (hook.cronExpr) return `⏱ ${hook.cronExpr}`
  if (hook.prEvent) {
    const branch = hook.branchPattern ? ` · ${hook.branchPattern}` : ''
    return `${hook.prEvent}${branch}`
  }
  if (hook.triggerTypes && hook.triggerTypes.length > 0) {
    const nonPr = hook.triggerTypes.filter(t => t !== 'pr_event')
    if (nonPr.length > 0) return nonPr.join(', ')
  }
  return null
}
