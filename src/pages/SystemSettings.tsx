import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { SystemSetting, UpsertSettingRequest } from '@/types/api'

// ── Setting catalog ────────────────────────────────────────────────────────────

type InputType = 'text' | 'boolean' | 'number' | 'select' | 'textarea'

interface SettingMeta {
  key: string
  label: string
  description: string
  isSecret?: boolean
  defaultValue?: string
  inputType?: InputType
  options?: string[]
  min?: number
  max?: number
  step?: number
}

interface SettingGroup {
  id: string
  label: string
  settings: SettingMeta[]
}

const CLAUDE_MODELS = [
  'claude-opus-4-5',
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-haiku-20240307',
]

const SETTING_GROUPS: SettingGroup[] = [
  // ── AI & Models ──────────────────────────────────────────────────────────────
  {
    id: 'ai',
    label: 'AI / Claude',
    settings: [
      { key: 'anthropic.api.key', label: 'API Key', description: 'Anthropic Claude API key', isSecret: true },
      { key: 'anthropic.model', label: 'Primary Model', description: 'Main Claude model for code agent tasks', defaultValue: 'claude-sonnet-4-20250514', inputType: 'select', options: CLAUDE_MODELS },
      { key: 'anthropic.fast-model', label: 'Fast Model', description: 'Cheaper model used for simple decisions', defaultValue: 'claude-3-5-haiku-20241022', inputType: 'select', options: CLAUDE_MODELS },
      { key: 'anthropic.max-tokens', label: 'Max Output Tokens', description: 'Maximum tokens per model response', defaultValue: '8192', inputType: 'number', min: 256 },
      { key: 'anthropic.rate-limit.tokens-per-minute', label: 'Tokens per Minute', description: 'TPM budget (Tier 1=40k, Tier 2=80k, Tier 3=160k, Tier 4=400k)', defaultValue: '80000', inputType: 'number', min: 1000, step: 1000 },
      { key: 'anthropic.rate-limit.safety-margin', label: 'Rate Limit Safety Margin', description: 'Fraction of TPM budget before throttling (0–1)', defaultValue: '0.80', inputType: 'number', min: 0.1, max: 1.0, step: 0.05 },
      { key: 'anthropic.pricing.input-per-million', label: 'Input Price (USD/M tokens)', description: 'Cost per million input tokens for cost tracking', defaultValue: '3.0', inputType: 'number', min: 0, step: 0.01 },
      { key: 'anthropic.pricing.output-per-million', label: 'Output Price (USD/M tokens)', description: 'Cost per million output tokens for cost tracking', defaultValue: '15.0', inputType: 'number', min: 0, step: 0.01 },
      { key: 'anthropic.pricing.cache-write-per-million', label: 'Cache Write Price (USD/M)', description: 'Cost per million cache-write tokens', defaultValue: '3.75', inputType: 'number', min: 0, step: 0.01 },
      { key: 'anthropic.pricing.cache-read-per-million', label: 'Cache Read Price (USD/M)', description: 'Cost per million cache-read tokens', defaultValue: '0.30', inputType: 'number', min: 0, step: 0.01 },
    ],
  },
  {
    id: 'voyage',
    label: 'Voyage AI (Embeddings)',
    settings: [
      { key: 'voyage.api.key', label: 'API Key', description: 'API key for Voyage AI embedding service', isSecret: true },
      { key: 'voyage.model', label: 'Model', description: 'Voyage AI embedding model', defaultValue: 'voyage-code-3', inputType: 'select', options: ['voyage-code-3', 'voyage-3', 'voyage-3-lite'] },
      { key: 'voyage.batch-size', label: 'Batch Size', description: 'Number of documents per embedding request', defaultValue: '128', inputType: 'number', min: 1 },
      { key: 'embedding.max-source-chars', label: 'Max Source Chars per Embedding', description: 'Maximum characters per source document sent to embedding', defaultValue: '16000', inputType: 'number', min: 1000, step: 1000 },
    ],
  },

  // ── Source Control ────────────────────────────────────────────────────────────
  {
    id: 'git',
    label: 'Git Platform',
    settings: [
      { key: 'git.platform', label: 'Platform', description: 'Active Git platform — determines which platform-specific credentials are used', defaultValue: 'bitbucket', inputType: 'select', options: ['bitbucket', 'azuredevops', 'gitlab', 'github'] },
      { key: 'git.username', label: 'Username', description: 'Username for cloning and pushing (falls back to platform-specific setting)' },
      { key: 'git.password', label: 'Password / Token', description: 'Password or token for cloning and pushing', isSecret: true },
      { key: 'git.author.name', label: 'Author Name', description: 'Git commit author name', defaultValue: 'code-agent' },
      { key: 'git.author.email', label: 'Author Email', description: 'Git commit author email' },
    ],
  },
  {
    id: 'bitbucket',
    label: 'Bitbucket',
    settings: [
      { key: 'bitbucket.base.url', label: 'Base URL', description: 'Bitbucket Cloud API base URL', defaultValue: 'https://api.bitbucket.org/2.0' },
      { key: 'bitbucket.workspace', label: 'Workspace', description: 'Bitbucket workspace slug' },
      { key: 'bitbucket.user', label: 'Username', description: 'Bitbucket username' },
      { key: 'bitbucket.app.password', label: 'App Password', description: 'Bitbucket app password for API access', isSecret: true },
    ],
  },
  {
    id: 'azuredevops',
    label: 'Azure DevOps',
    settings: [
      { key: 'azuredevops.base.url', label: 'Base URL', description: 'Azure DevOps organisation URL', defaultValue: 'https://dev.azure.com' },
      { key: 'azuredevops.pat', label: 'Personal Access Token', description: 'Azure DevOps PAT with Code (read/write) permission', isSecret: true },
      { key: 'azuredevops.agent.user', label: 'Agent User', description: 'Azure DevOps display name of the agent service account' },
    ],
  },
  {
    id: 'gitlab',
    label: 'GitLab',
    settings: [
      { key: 'gitlab.base.url', label: 'Base URL', description: 'GitLab API base URL', defaultValue: 'https://gitlab.com/api/v4' },
      { key: 'gitlab.token', label: 'Access Token', description: 'GitLab personal or project access token', isSecret: true },
      { key: 'gitlab.agent.user', label: 'Agent User', description: 'GitLab username of the agent service account' },
    ],
  },
  {
    id: 'github',
    label: 'GitHub',
    settings: [
      { key: 'github.base.url', label: 'Base URL', description: 'GitHub API base URL', defaultValue: 'https://api.github.com' },
      { key: 'github.token', label: 'Access Token', description: 'GitHub personal access token or fine-grained token', isSecret: true },
      { key: 'github.agent.user', label: 'Agent User', description: 'GitHub username of the agent service account' },
    ],
  },

  // ── Integrations ──────────────────────────────────────────────────────────────
  {
    id: 'jira',
    label: 'JIRA',
    settings: [
      { key: 'jira.base.url', label: 'Base URL', description: 'Jira Cloud or Server base URL', defaultValue: 'https://yourorg.atlassian.net' },
      { key: 'jira.user', label: 'Username', description: 'Jira username or email address' },
      { key: 'jira.api.token', label: 'API Token', description: 'Jira API token (personal access token)', isSecret: true },
      { key: 'jira.transition.in-review', label: 'Transition: In Review', description: 'Jira transition ID to move ticket to "In Review"' },
      { key: 'jira.transition.done', label: 'Transition: Done', description: 'Jira transition ID to move ticket to "Done"' },
      { key: 'jira.transition.rejected', label: 'Transition: Rejected', description: 'Jira transition ID to move ticket to "Rejected"' },
      { key: 'jira.default.worklog', label: 'Default Worklog', description: 'Default worklog duration logged per task', defaultValue: '30m', inputType: 'select', options: ['15m', '30m', '1h', '2h', '4h', '8h'] },
      { key: 'jira.agent.assignee', label: 'Agent Assignee ID', description: 'Jira account ID to assign agent-worked tickets to' },
      { key: 'jira.agent.label', label: 'Agent Trigger Label', description: 'Jira label that triggers the agent', defaultValue: 'WALL-E' },
      { key: 'jira.agent.default-repo-url', label: 'Default Repo URL', description: 'Fallback repository URL when not specified in the ticket' },
    ],
  },
  {
    id: 'confluence',
    label: 'Confluence',
    settings: [
      { key: 'confluence.base.url', label: 'Base URL', description: 'Confluence Cloud or Server API base URL' },
      { key: 'confluence.user', label: 'Username', description: 'Confluence username or email address' },
      { key: 'confluence.api.token', label: 'API Token', description: 'Confluence API token (personal access token)', isSecret: true },
    ],
  },
  {
    id: 'knowledge',
    label: 'Knowledge Indexer',
    settings: [
      { key: 'knowledge.indexer.jira-max-results', label: 'Jira Max Results', description: 'Maximum number of Jira issues fetched per project in a single indexing pass', defaultValue: '200', inputType: 'number', min: 1 },
      { key: 'knowledge.indexer.max-attachment-bytes', label: 'Max Attachment Size (bytes)', description: 'Maximum attachment size in bytes that will be downloaded and indexed', defaultValue: '5242880', inputType: 'number', min: 1 },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    settings: [
      { key: 'teams.webhook.url', label: 'MS Teams Webhook URL', description: 'Incoming webhook URL for Microsoft Teams notifications' },
      { key: 'n8n.webhook.url', label: 'n8n Webhook URL', description: 'n8n automation webhook URL for custom notification workflows' },
      { key: 'agent.base.url', label: 'Agent Base URL', description: 'Externally reachable URL of the agent; used for automatic webhook registration' },
    ],
  },

  // ── AWS ───────────────────────────────────────────────────────────────────────
  {
    id: 'aws',
    label: 'AWS Tools',
    settings: [
      { key: 'tools.aws.enabled', label: 'AWS Tools Enabled', description: 'Enable AWS CloudWatch, ECS, and Metrics tools for the agent', defaultValue: 'true', inputType: 'boolean' },
      { key: 'aws.region', label: 'Default Region', description: 'Default AWS region used when no region is specified in the product environment config', defaultValue: 'eu-central-1' },
      { key: 'aws.access-key-id', label: 'Access Key ID', description: 'Explicit AWS access key for local development. Leave blank to use the ECS task role or default credential chain.', isSecret: true },
      { key: 'aws.secret-access-key', label: 'Secret Access Key', description: 'Explicit AWS secret key for local development. Leave blank to use the ECS task role or default credential chain.', isSecret: true },
    ],
  },

  // ── Agent ─────────────────────────────────────────────────────────────────────
  {
    id: 'agent',
    label: 'Agent Behaviour',
    settings: [
      { key: 'run-fix.max-concurrent-jobs', label: 'Max Concurrent Jobs', description: 'Maximum number of fix/generate jobs running in parallel', defaultValue: '3', inputType: 'number', min: 1 },
      { key: 'run-fix.max-queue-size', label: 'Max Queue Size', description: 'Maximum number of jobs that can wait in queue', defaultValue: '20', inputType: 'number', min: 1 },
      { key: 'run-fix.blocked-paths', label: 'Blocked Paths', description: 'Comma-separated paths the agent is not allowed to modify', defaultValue: 'src/main/security,src/main/billing,.github,.env', inputType: 'textarea' },
      { key: 'run-fix.allowed-commands', label: 'Allowed Commands', description: 'Comma-separated shell commands the agent is permitted to run', inputType: 'textarea' },
      { key: 'run-fix.max-files-changed', label: 'Max Files Changed', description: 'Maximum number of files the agent may modify per job', defaultValue: '10', inputType: 'number', min: 1 },
      { key: 'run-fix.max-lines-changed', label: 'Max Lines Changed', description: 'Maximum lines the agent may change per job', defaultValue: '500', inputType: 'number', min: 1 },
      { key: 'run-fix.max-loop-iterations', label: 'Max Loop Iterations', description: 'Maximum agent loop cycles before the job is aborted', defaultValue: '150', inputType: 'number', min: 1 },
      { key: 'run-fix.job-timeout-minutes', label: 'Job Timeout (minutes)', description: 'Total wall-clock timeout per fix job', defaultValue: '30', inputType: 'number', min: 1 },
      { key: 'run-fix.max-build-retries', label: 'Max Build Retries', description: 'Number of times to retry a failing build before giving up', defaultValue: '2', inputType: 'number', min: 0 },
      { key: 'run-fix.self-review.enabled', label: 'Self-Review', description: 'Agent self-reviews its own changes before submitting', defaultValue: 'true', inputType: 'boolean' },
      { key: 'run-fix.self-review.max-iterations', label: 'Self-Review Max Iterations', description: 'Maximum self-review loop cycles', defaultValue: '15', inputType: 'number', min: 1 },
      { key: 'run-fix.self-review.max-diff-chars', label: 'Self-Review Max Diff Chars', description: 'Maximum diff size sent to self-review (characters)', defaultValue: '30000', inputType: 'number', min: 1000, step: 1000 },
      { key: 'tools.fetch-url.enabled', label: 'Fetch URL Tool', description: 'Allow the agent to fetch external documentation URLs', defaultValue: 'true', inputType: 'boolean' },
      { key: 'tools.fetch-url.timeout-seconds', label: 'Fetch URL Timeout (seconds)', description: 'Timeout for external URL fetches', defaultValue: '15', inputType: 'number', min: 1 },
      { key: 'tools.fetch-url.allowed-domains', label: 'Fetch URL Allowed Domains', description: 'Comma-separated domain allowlist for URL fetches. Blank = all public HTTPS.', defaultValue: 'quarkus.io,search.maven.org', inputType: 'textarea' },
    ],
  },
  {
    id: 'schedulers',
    label: 'Schedulers',
    settings: [
      { key: 'quality-report.scheduler.enabled', label: 'Quality Report Scheduler', description: 'Enable automated quality report collection', defaultValue: 'false', inputType: 'boolean' },
      { key: 'quality-report.branches', label: 'Quality Report Branches', description: 'Comma-separated branches to collect quality reports for', defaultValue: 'main,develop', inputType: 'textarea' },
      { key: 'quality-report.cc-threshold', label: 'Quality Report CC Threshold', description: 'Cyclomatic complexity threshold to flag in quality reports', defaultValue: '10', inputType: 'number', min: 1 },
      { key: 'quality-report.job-timeout-minutes', label: 'Quality Report Timeout (minutes)', description: 'Timeout per quality report job', defaultValue: '30', inputType: 'number', min: 1 },
      { key: 'upgrade.scheduler.enabled', label: 'Upgrade Scheduler', description: 'Enable automated dependency upgrade jobs', defaultValue: 'false', inputType: 'boolean' },
      { key: 'upgrade.scheduler.default-branch', label: 'Upgrade Target Branch', description: 'Default branch for upgrade scheduler jobs', defaultValue: 'develop' },
      { key: 'upgrade.scheduler.version-cache-minutes', label: 'Version Cache (minutes)', description: 'How long to cache resolved dependency versions', defaultValue: '60', inputType: 'number', min: 1 },
      { key: 'code-graph.scheduler.enabled', label: 'Code Graph Scheduler', description: 'Enable automated code graph indexing', defaultValue: 'true', inputType: 'boolean' },
      { key: 'code-graph.scheduler.default-branch', label: 'Code Graph Default Branch', description: 'Branch to index for code graph', defaultValue: 'main' },
      { key: 'code-graph.scheduler.clone-timeout-minutes', label: 'Code Graph Clone Timeout (minutes)', description: 'Timeout for cloning a repository during code graph indexing', defaultValue: '10', inputType: 'number', min: 1 },
      { key: 'code-graph.cross-repo.enabled', label: 'Cross-Repo Analysis', description: 'Enable cross-repository dependency analysis in the code graph', defaultValue: 'true', inputType: 'boolean' },
      { key: 'code-graph.cross-repo.critical-threshold', label: 'Cross-Repo Critical Threshold', description: 'Number of repos using a symbol before it is labelled CRITICAL in impact analysis', defaultValue: '3', inputType: 'number', min: 1 },
    ],
  },
  {
    id: 'linter',
    label: 'Linter / SAST',
    settings: [
      { key: 'linter.enabled', label: 'Linter Enabled', description: 'Master toggle for all linting tools', defaultValue: 'true', inputType: 'boolean' },
      { key: 'linter.checkstyle.enabled', label: 'Checkstyle', description: 'Enable Checkstyle for Java projects', defaultValue: 'true', inputType: 'boolean' },
      { key: 'linter.pmd.enabled', label: 'PMD', description: 'Enable PMD static analysis for Java projects', defaultValue: 'true', inputType: 'boolean' },
      { key: 'linter.spotbugs.enabled', label: 'SpotBugs', description: 'Enable SpotBugs for Java projects', defaultValue: 'true', inputType: 'boolean' },
      { key: 'linter.eslint.enabled', label: 'ESLint', description: 'Enable ESLint for JavaScript/TypeScript projects', defaultValue: 'true', inputType: 'boolean' },
      { key: 'linter.dotnet-format.enabled', label: 'dotnet-format', description: 'Enable dotnet-format for .NET projects', defaultValue: 'true', inputType: 'boolean' },
      { key: 'linter.phpstan.enabled', label: 'PHPStan', description: 'Enable PHPStan for PHP projects', defaultValue: 'true', inputType: 'boolean' },
      { key: 'linter.max-fix-iterations', label: 'Max Fix Iterations', description: 'Number of lint → fix cycles per job', defaultValue: '2', inputType: 'number', min: 0 },
      { key: 'linter.fail-on-new-issues', label: 'Fail on New Issues', description: 'Fail the job if linting introduces new issues', defaultValue: 'false', inputType: 'boolean' },
      { key: 'linter.timeout-minutes', label: 'Timeout (minutes)', description: 'Total linting timeout per job', defaultValue: '10', inputType: 'number', min: 1 },
      { key: 'linter.report-on-pr', label: 'Report on PR', description: 'Post linting results as PR comments', defaultValue: 'true', inputType: 'boolean' },
      { key: 'linter.scope-to-changed-files', label: 'Scope to Changed Files', description: 'Only lint files changed in the current job', defaultValue: 'true', inputType: 'boolean' },
      { key: 'linter.line-tolerance', label: 'Line Tolerance', description: 'Number of linting-issue lines tolerated before failing', defaultValue: '5', inputType: 'number', min: 0 },
    ],
  },
  {
    id: 'review',
    label: 'PR Review & Metrics',
    settings: [
      { key: 'review.webhook.skip-authors', label: 'Skip Authors', description: 'Comma-separated PR author names that skip automatic review', defaultValue: 'code-agent', inputType: 'textarea' },
      { key: 'review.pr-summary.enabled', label: 'PR Summary', description: 'Post a CodeRabbit-style PR summary before the review', defaultValue: 'true', inputType: 'boolean' },
      { key: 'review.sequence-diagrams.enabled', label: 'Sequence Diagrams in Summary', description: 'Include Mermaid sequence diagrams in PR summaries', defaultValue: 'true', inputType: 'boolean' },
      { key: 'metrics.cc-threshold', label: 'CC Threshold', description: 'Cyclomatic complexity threshold for flagging methods', defaultValue: '10', inputType: 'number', min: 1 },
      { key: 'metrics.max-iterations', label: 'Metrics Fix Iterations', description: 'Number of FIX → METRICS improvement cycles', defaultValue: '3', inputType: 'number', min: 1 },
      { key: 'metrics.max-methods-per-fix', label: 'Max Methods per Fix', description: 'High-CC methods to address per FIX step', defaultValue: '10', inputType: 'number', min: 1 },
      { key: 'planner.enabled', label: 'Planner', description: 'Enable AI task planning before code generation', defaultValue: 'true', inputType: 'boolean' },
      { key: 'planner.max-tokens', label: 'Planner Max Tokens', description: 'Max tokens for planner model response', defaultValue: '8192', inputType: 'number', min: 1024 },
    ],
  },

  // ── Security ──────────────────────────────────────────────────────────────────
  {
    id: 'security',
    label: 'Security',
    settings: [
      { key: 'api.key', label: 'API Key', description: 'Shared API key for all REST endpoints. Leave blank to disable auth in dev mode.', isSecret: true },
      { key: 'settings.encryption.key', label: 'Settings Encryption Key', description: '64-char hex key (32 bytes) for AES-256-GCM encryption of secrets. Generate: openssl rand -hex 32', isSecret: true },
      { key: 'webhook.secret.bitbucket', label: 'Webhook Secret: Bitbucket', description: 'HMAC-SHA256 secret for validating Bitbucket webhook payloads', isSecret: true },
      { key: 'webhook.secret.azuredevops', label: 'Webhook Secret: Azure DevOps', description: 'HMAC-SHA256 secret for validating Azure DevOps webhook payloads', isSecret: true },
      { key: 'webhook.secret.gitlab', label: 'Webhook Secret: GitLab', description: 'HMAC-SHA256 secret for validating GitLab webhook payloads', isSecret: true },
      { key: 'webhook.secret.github', label: 'Webhook Secret: GitHub', description: 'HMAC-SHA256 secret for validating GitHub webhook payloads', isSecret: true },
      { key: 'webhook.secret.jira', label: 'Webhook Secret: JIRA', description: 'HMAC-SHA256 secret for validating JIRA webhook payloads', isSecret: true },
      { key: 'webhook.secret.aikido', label: 'Webhook Secret: Aikido', description: 'HMAC-SHA256 secret for validating Aikido webhook payloads', isSecret: true },
    ],
  },
]

// ── Tab definition ─────────────────────────────────────────────────────────────

interface TabDef {
  id: string
  label: string
  groupIds: string[]
}

const TABS: TabDef[] = [
  { id: 'ai-models',     label: 'AI & Models',    groupIds: ['ai', 'voyage'] },
  { id: 'source-ctrl',  label: 'Source Control', groupIds: ['git', 'bitbucket', 'azuredevops', 'gitlab', 'github'] },
  { id: 'integrations', label: 'Integrations',   groupIds: ['jira', 'confluence', 'knowledge', 'notifications'] },
  { id: 'agent',        label: 'Agent',          groupIds: ['agent', 'aws', 'schedulers', 'linter', 'review'] },
  { id: 'security',     label: 'Security',       groupIds: ['security'] },
]

const GROUP_BY_ID = new Map(SETTING_GROUPS.map((g) => [g.id, g]))

// ── Shared input styles ────────────────────────────────────────────────────────

const inputCls =
  'w-full h-8 px-3 text-sm font-mono rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] placeholder:text-[var(--color-fonts-font-color-support)]'

const selectCls =
  'w-full h-8 px-3 text-sm rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] cursor-pointer'

const textareaCls =
  'w-full px-3 py-2 text-sm font-mono rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] placeholder:text-[var(--color-fonts-font-color-support)] resize-none'

// ── Toast ──────────────────────────────────────────────────────────────────────

interface ToastMsg {
  id: number
  text: string
  type: 'success' | 'error'
}

let toastId = 0

// ── Toggle pill ────────────────────────────────────────────────────────────────

function TogglePill({
  checked,
  onChange,
  disabled,
  dimmed,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  dimmed?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      title={checked ? 'Enabled — click to disable' : 'Disabled — click to enable'}
      className={`relative inline-flex w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked
          ? dimmed
            ? 'bg-[var(--color-buttons-button-primary)] opacity-50'
            : 'bg-[var(--color-buttons-button-primary)]'
          : 'bg-[var(--color-inputs-input-border)]'
      } disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none`}
    >
      <span
        className={`pointer-events-none absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ── Boolean setting row ────────────────────────────────────────────────────────

function BooleanSettingRow({
  meta,
  current,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  meta: SettingMeta
  current?: SystemSetting
  onSave: (key: string, req: UpsertSettingRequest) => void
  onDelete: (key: string) => void
  isSaving: boolean
  isDeleting: boolean
}) {
  const isOverridden = !!current
  const effectiveValue = isOverridden
    ? current.value === 'true'
    : meta.defaultValue === 'true'

  function handleToggle() {
    onSave(meta.key, {
      value: String(!effectiveValue),
      isSecret: false,
      description: meta.description,
    })
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-cards-card-stroke)] last:border-0">
      {/* Key + description */}
      <div className="flex-1 min-w-0">
        <code className="text-xs font-mono text-[var(--color-fonts-font-color-headings)]">
          {meta.key}
        </code>
        <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5 leading-relaxed">
          {meta.description}
        </p>
      </div>

      {/* Toggle + reset */}
      <div className="flex items-center gap-2 shrink-0">
        {!isOverridden && (
          <span className="text-xs text-[var(--color-fonts-font-color-support)] italic">
            default
          </span>
        )}
        <TogglePill
          checked={effectiveValue}
          onChange={handleToggle}
          disabled={isSaving}
          dimmed={!isOverridden}
        />
        {isOverridden && (
          <button
            title="Reset to default"
            onClick={() => onDelete(meta.key)}
            disabled={isDeleting}
            className="p-1.5 rounded-[var(--border-radius-small)] hover:bg-[var(--color-tags-critical-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] transition-colors disabled:opacity-40"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Editable setting row (text / number / select / textarea / secret) ──────────

function EditableSettingRow({
  meta,
  current,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  meta: SettingMeta
  current?: SystemSetting
  onSave: (key: string, req: UpsertSettingRequest) => void
  onDelete: (key: string) => void
  isSaving: boolean
  isDeleting: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [showSecret, setShowSecret] = useState(false)

  const isOverridden = !!current
  const isSecret = !!meta.isSecret
  const inputType = meta.inputType ?? 'text'

  function startEdit() {
    setInputValue(isOverridden && current.value !== '****' ? current.value : (meta.defaultValue ?? ''))
    setEditing(true)
    setShowSecret(false)
  }

  function cancelEdit() {
    setEditing(false)
    setInputValue('')
    setShowSecret(false)
  }

  function handleSave() {
    const v = inputValue.trim()
    if (!v) return
    onSave(meta.key, { value: v, isSecret, description: meta.description })
    setEditing(false)
    setInputValue('')
  }

  const displayValue = isOverridden ? (isSecret ? '••••••••' : current.value) : null

  return (
    <div className="border-b border-[var(--color-cards-card-stroke)] last:border-0">
      <div className="flex items-start gap-4 px-4 py-3">
        {/* Key + description */}
        <div className="flex-1 min-w-0">
          <code className="text-xs font-mono text-[var(--color-fonts-font-color-headings)]">
            {meta.key}
          </code>
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5 leading-relaxed">
            {meta.description}
            {meta.defaultValue && !isOverridden && (
              <span className="ml-1">
                — default: <span className="font-mono">{meta.defaultValue}</span>
              </span>
            )}
          </p>
        </div>

        {/* Value badge + actions */}
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {isOverridden ? (
            <span className="text-xs font-mono px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)] max-w-48 truncate">
              {displayValue}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
              using default
            </span>
          )}

          <button
            title="Edit"
            onClick={startEdit}
            disabled={editing || isSaving}
            className="p-1.5 rounded-[var(--border-radius-small)] hover:bg-[var(--color-navigation-menu-item-hover-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors disabled:opacity-40"
          >
            <Pencil size={13} />
          </button>

          {isOverridden && (
            <button
              title="Reset to default"
              onClick={() => onDelete(meta.key)}
              disabled={isDeleting || editing}
              className="p-1.5 rounded-[var(--border-radius-small)] hover:bg-[var(--color-tags-critical-background)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-tags-font-critical)] transition-colors disabled:opacity-40"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Inline edit form */}
      {editing && (
        <div className="px-4 pb-3 pt-0">
          <div className={`flex gap-2 ${inputType === 'textarea' ? 'items-end' : 'items-center'}`}>
            {/* Input element */}
            <div className="relative flex-1">
              {inputType === 'select' ? (
                <select
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  autoFocus
                  className={selectCls}
                >
                  {(meta.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : inputType === 'textarea' ? (
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  placeholder={meta.defaultValue ?? `Enter value for ${meta.key}`}
                  autoFocus
                  rows={3}
                  className={textareaCls}
                />
              ) : (
                <input
                  type={isSecret && !showSecret ? 'password' : inputType === 'number' ? 'number' : 'text'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave()
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  placeholder={meta.defaultValue ?? `Enter value for ${meta.key}`}
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  autoFocus
                  className={`${inputCls} ${isSecret ? 'pr-8' : ''}`}
                />
              )}
              {isSecret && inputType !== 'textarea' && (
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
                >
                  {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
            </div>

            {/* Save / Cancel */}
            <button
              onClick={handleSave}
              disabled={!inputValue.trim() || isSaving}
              title="Save"
              className="p-1.5 rounded-[var(--border-radius-small)] bg-[var(--color-buttons-button-primary)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
            >
              <Check size={14} />
            </button>
            <button
              onClick={cancelEdit}
              title="Cancel"
              className="p-1.5 rounded-[var(--border-radius-small)] bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)] transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          {isSecret && (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1.5">
              Value will be stored encrypted.
            </p>
          )}
          {inputType === 'textarea' && (
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1.5">
              Separate multiple values with commas.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Unified setting row dispatcher ─────────────────────────────────────────────

function SettingRow(props: {
  meta: SettingMeta
  current?: SystemSetting
  onSave: (key: string, req: UpsertSettingRequest) => void
  onDelete: (key: string) => void
  isSaving: boolean
  isDeleting: boolean
}) {
  if (props.meta.inputType === 'boolean') {
    return <BooleanSettingRow {...props} />
  }
  return <EditableSettingRow {...props} />
}

// ── Accordion section ──────────────────────────────────────────────────────────

function SettingSection({
  group,
  overrides,
  onSave,
  onDelete,
  savingKey,
  deletingKey,
  defaultOpen = true,
}: {
  group: SettingGroup
  overrides: Map<string, SystemSetting>
  onSave: (key: string, req: UpsertSettingRequest) => void
  onDelete: (key: string) => void
  savingKey: string | null
  deletingKey: string | null
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const overriddenCount = group.settings.filter((s) => overrides.has(s.key)).length

  return (
    <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] overflow-hidden mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--color-navigation-menu-item-hover-background)] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown size={15} className="text-[var(--color-fonts-font-color-support)]" />
          ) : (
            <ChevronRight size={15} className="text-[var(--color-fonts-font-color-support)]" />
          )}
          <span className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)]">
            {group.label}
          </span>
          <span className="text-xs text-[var(--color-fonts-font-color-support)]">
            {group.settings.length} settings
          </span>
        </div>
        {overriddenCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]">
            {overriddenCount} overridden
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-[var(--color-cards-card-stroke)]">
          {group.settings.map((meta) => (
            <SettingRow
              key={meta.key}
              meta={meta}
              current={overrides.get(meta.key)}
              onSave={onSave}
              onDelete={onDelete}
              isSaving={savingKey === meta.key}
              isDeleting={deletingKey === meta.key}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Toast list ─────────────────────────────────────────────────────────────────

function ToastList({ toasts }: { toasts: ToastMsg[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2.5 rounded-[var(--border-radius-card)] shadow-lg text-sm font-medium ${
            t.type === 'success'
              ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)] border border-[var(--color-tags-font-success)]'
              : 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)] border border-[var(--color-tags-font-critical)]'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SystemSettingsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState(TABS[0].id)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const [search, setSearch] = useState('')

  function addToast(text: string, type: 'success' | 'error') {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, text, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  const { data: settingsList, isLoading } = useQuery<SystemSetting[]>({
    queryKey: ['system-settings'],
    queryFn: () => api.get('/settings').then((r) => r.data).catch(() => []),
  })

  const overrides = new Map<string, SystemSetting>(
    (Array.isArray(settingsList) ? settingsList : []).map((s) => [s.key, s]),
  )

  const saveMutation = useMutation({
    mutationFn: ({ key, req }: { key: string; req: UpsertSettingRequest }) =>
      api.put(`/settings/${key}`, req),
    onMutate: ({ key }) => setSavingKey(key),
    onSuccess: (_data, { key }) => {
      qc.invalidateQueries({ queryKey: ['system-settings'] })
      addToast(`Saved ${key}`, 'success')
    },
    onError: (_err, { key }) => addToast(`Failed to save ${key}`, 'error'),
    onSettled: () => setSavingKey(null),
  })

  const deleteMutation = useMutation({
    mutationFn: (key: string) => api.delete(`/settings/${key}`),
    onMutate: (key) => setDeletingKey(key),
    onSuccess: (_data, key) => {
      qc.invalidateQueries({ queryKey: ['system-settings'] })
      addToast(`Reset ${key} to default`, 'success')
    },
    onError: (_err, key) => addToast(`Failed to reset ${key}`, 'error'),
    onSettled: () => setDeletingKey(null),
  })

  const handleSave = (key: string, req: UpsertSettingRequest) =>
    saveMutation.mutate({ key, req })

  const handleDelete = (key: string) => deleteMutation.mutate(key)

  const lowerSearch = search.toLowerCase().trim()
  const isSearching = lowerSearch.length > 0

  const searchGroups = SETTING_GROUPS.map((group) => ({
    ...group,
    settings: group.settings.filter(
      (s) =>
        s.key.toLowerCase().includes(lowerSearch) ||
        s.label.toLowerCase().includes(lowerSearch) ||
        s.description.toLowerCase().includes(lowerSearch),
    ),
  })).filter((g) => g.settings.length > 0)

  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0]
  const tabGroups = currentTab.groupIds
    .map((id) => GROUP_BY_ID.get(id))
    .filter((g): g is SettingGroup => !!g)

  const totalOverridden = overrides.size
  const totalSettings = SETTING_GROUPS.reduce((n, g) => n + g.settings.length, 0)

  function tabOverrideCount(tab: TabDef) {
    return tab.groupIds
      .flatMap((id) => GROUP_BY_ID.get(id)?.settings ?? [])
      .filter((s) => overrides.has(s.key)).length
  }

  const sectionProps = {
    overrides,
    onSave: handleSave,
    onDelete: handleDelete,
    savingKey,
    deletingKey,
  }

  return (
    <main>
      <PageHeader
        title="System Settings"
        subtitle="Manage runtime configuration overrides. Changes take effect within 30 seconds without restarting."
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search all settings…"
          className="h-8 px-3 rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-sm text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] placeholder:text-[var(--color-fonts-font-color-support)] w-64"
        />
        <span className="ml-auto text-xs text-[var(--color-fonts-font-color-support)]">
          {isLoading ? '…' : `${totalOverridden} of ${totalSettings} settings overridden`}
        </span>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      )}

      {!isLoading && (
        <>
          {isSearching ? (
            <>
              {searchGroups.length === 0 ? (
                <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] px-4 py-12 text-center text-sm text-[var(--color-fonts-font-color-support)]">
                  No settings match &ldquo;{search}&rdquo;.
                </div>
              ) : (
                searchGroups.map((group) => (
                  <SettingSection key={group.id} group={group} {...sectionProps} />
                ))
              )}
            </>
          ) : (
            <>
              {/* Tab bar */}
              <div className="flex gap-1 mb-4 border-b border-[var(--color-cards-card-stroke)]">
                {TABS.map((tab) => {
                  const count = tabOverrideCount(tab)
                  const active = tab.id === activeTab
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                        active
                          ? 'border-[var(--color-buttons-button-primary)] text-[var(--color-fonts-font-color-headings)]'
                          : 'border-transparent text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:border-[var(--color-cards-card-stroke)]'
                      }`}
                    >
                      {tab.label}
                      {count > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)] leading-none">
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Tab content */}
              {tabGroups.map((group, idx) => (
                <SettingSection
                  key={group.id}
                  group={group}
                  defaultOpen={idx === 0}
                  {...sectionProps}
                />
              ))}
            </>
          )}
        </>
      )}

      <ToastList toasts={toasts} />
    </main>
  )
}
