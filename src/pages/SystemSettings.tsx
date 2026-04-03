import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import {
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
  Cloud,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, type SelectOption } from '@/components/ui/Select'
import { Toast } from '@/components/ui/Toast'
import api from '@/lib/api'
import type { SystemSetting, UpsertSettingRequest, CloudAccount, CloudAccountType } from '@/types/api'

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
      { key: 'anthropic.summary-model', label: 'Summary Model', description: 'Model used for PR summary generation. Defaults to Fast Model if not set.', inputType: 'select', options: CLAUDE_MODELS },
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
    id: 'bedrock',
    label: 'AWS Bedrock (Embeddings)',
    settings: [
      { key: 'bedrock.region', label: 'Region', description: 'AWS region for Bedrock API calls. All data stays within this region.', defaultValue: 'eu-central-1' },
      {
        key: 'bedrock.code.embedding.model',
        label: 'Code Embedding Model',
        description: 'Embedding model for code indexing and semantic code search (→ code_embeddings table). Query and document embeddings must use the same model.',
        defaultValue: 'cohere.embed-multilingual-v3',
        inputType: 'select',
        options: ['cohere.embed-multilingual-v3', 'cohere.embed-english-v3', 'amazon.titan-embed-text-v2:0'],
      },
      {
        key: 'bedrock.text.embedding.model',
        label: 'Text Embedding Model',
        description: 'Embedding model for knowledge base indexing and search — Jira, Confluence, web docs (→ knowledge_embeddings table).',
        defaultValue: 'amazon.titan-embed-text-v2:0',
        inputType: 'select',
        options: ['amazon.titan-embed-text-v2:0', 'cohere.embed-multilingual-v3', 'cohere.embed-english-v3'],
      },
      {
        key: 'bedrock.rerank.model',
        label: 'Rerank Model',
        description: 'Rerank model used in the two-stage semantic code search pipeline.',
        defaultValue: 'amazon.rerank-v1:0',
        inputType: 'select',
        options: ['amazon.rerank-v1:0', 'cohere.rerank-v3-5:0'],
      },
      { key: 'embedding.max-source-chars', label: 'Max Source Chars per Embedding', description: 'Maximum characters per source document sent to the embedding model', defaultValue: '16000', inputType: 'number', min: 1000, step: 1000 },
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
      {
        key: 'bitbucket.oauth.client-id',
        label: 'OAuth Consumer Key',
        description: 'Recommended — OAuth 2.0 Client Credentials (Workspace Settings → OAuth Consumers). Enables /user identity resolution and automatic token refresh. Takes priority over App Password when set.',
      },
      {
        key: 'bitbucket.oauth.client-secret',
        label: 'OAuth Consumer Secret',
        description: 'Secret for the OAuth Consumer above.',
        isSecret: true,
      },
      { key: 'bitbucket.user', label: 'App Password Username', description: 'Fallback — Bitbucket username for App Password auth (leave blank when using OAuth).' },
      { key: 'bitbucket.app.password', label: 'App Password', description: 'Fallback — Bitbucket App Password (leave blank when using OAuth).', isSecret: true },
      { key: 'bitbucket.webhook.sync.enabled', label: 'Webhook Sync', description: 'Automatically register agent webhooks on Bitbucket repositories during sync', defaultValue: 'true', inputType: 'boolean' },
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
      {
        key: 'atlassian.oauth.client-id',
        label: 'OAuth Client ID',
        description: 'Recommended — Atlassian OAuth 2.0 app Client ID (developer.atlassian.com). Enables per-user "Connect with Atlassian" linking in the Profile dialog. Takes priority over username/API token when set.',
      },
      {
        key: 'atlassian.oauth.client-secret',
        label: 'OAuth Client Secret',
        description: 'Secret for the Atlassian OAuth 2.0 app above.',
        isSecret: true,
      },
      {
        key: 'atlassian.oauth.redirect-uri',
        label: 'OAuth Redirect URI',
        description: 'Required when the backend sits behind a TLS-terminating proxy. Set to the exact https:// callback URL registered in your Atlassian OAuth app, e.g. https://code-agent.example.com/api/mcp/oauth/callback. Overrides the browser-derived URL.',
        defaultValue: '',
      },
      { key: 'jira.user', label: 'Service Account Username', description: 'Fallback — Jira username or email for server-side bot operations (leave blank when using OAuth for all access).' },
      { key: 'jira.api.token', label: 'Service Account API Token', description: 'Fallback — Jira API token for the service account above.', isSecret: true },
      { key: 'jira.transition.in-progress', label: 'Transition: In Progress', description: 'Jira transition ID to move ticket to "In Progress"' },
      { key: 'jira.transition.in-review', label: 'Transition: In Review', description: 'Jira transition ID to move ticket to "In Review"' },
      { key: 'jira.transition.done', label: 'Transition: Done', description: 'Jira transition ID to move ticket to "Done"' },
      { key: 'jira.transition.rejected', label: 'Transition: Rejected', description: 'Jira transition ID to move ticket to "Rejected"' },
      { key: 'jira.default.worklog', label: 'Default Worklog', description: 'Default worklog duration logged per task', defaultValue: '30m', inputType: 'select', options: ['15m', '30m', '1h', '2h', '4h', '8h'] },
      { key: 'jira.agent.assignee', label: 'Agent Assignee ID', description: 'Jira account ID to assign agent-worked tickets to' },
      { key: 'jira.agent.label', label: 'Agent Trigger Label', description: 'Jira label that triggers the agent', defaultValue: 'WALL-E' },
      { key: 'jira.agent.default-repo-url', label: 'Default Repo URL', description: 'Fallback repository URL when not specified in the ticket' },
      { key: 'jira.billing-category-field', label: 'Billing Category Field ID', description: 'Jira custom field ID for billing category on created issues. Leave blank to omit.' },
      { key: 'jira.billing-code-field', label: 'Billing Code Field ID', description: 'Jira custom field ID for billing code on created issues. Leave blank to omit.' },
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
    id: 'xray',
    label: 'Xray Cloud (QA)',
    settings: [
      { key: 'xray.base-url', label: 'Base URL', description: 'Xray Cloud API base URL — US: https://xray.cloud.getxray.app, EU: https://eu.xray.cloud.getxray.app', defaultValue: 'https://xray.cloud.getxray.app' },
      { key: 'xray.client-id', label: 'Client ID', description: 'Xray Cloud OAuth2 client ID (from Xray → API Keys)' },
      { key: 'xray.client-secret', label: 'Client Secret', description: 'Xray Cloud OAuth2 client secret — used by schedulers and background jobs that run without a user context', isSecret: true },
    ],
  },
  {
    id: 'web-search',
    label: 'Web Search (Tavily)',
    settings: [
      { key: 'tools.web-search.enabled', label: 'Web Search Enabled', description: 'Allow the AI to search the web via Tavily. Requires an API key below.', defaultValue: 'true', inputType: 'boolean' },
      { key: 'tools.web-search.tavily-api-key', label: 'Tavily API Key', description: 'API key from app.tavily.com. Stored encrypted. Set TAVILY_API_KEY env var or enter here.', isSecret: true },
      { key: 'tools.web-search.max-results', label: 'Max Results per Query', description: 'Number of search results returned per query (default: 5, max: 10)', defaultValue: '5', inputType: 'number', min: 1, max: 10 },
    ],
  },
  {
    id: 'mcp',
    label: 'MCP / Linked Accounts',
    settings: [
      { key: 'mcp.system-credential-fallback.enabled', label: 'System Credential Fallback', description: 'Allow MCP tools to fall back to system-level credentials when no linked account is found for the current user', defaultValue: 'false', inputType: 'boolean' },
    ],
  },
  {
    id: 'knowledge',
    label: 'Knowledge Indexer',
    settings: [
      { key: 'knowledge.indexer.jira-max-results', label: 'Jira Max Results', description: 'Maximum number of Jira issues fetched per project in a single full indexing pass', defaultValue: '200', inputType: 'number', min: 1 },
      { key: 'knowledge.indexer.jira-jql-extra', label: 'Jira JQL Extra Conditions', description: 'Additional JQL conditions AND-ed to the base project query before issues are fetched. Useful to pre-filter stubs. Leave blank to disable. Default: description is not EMPTY', defaultValue: 'description is not EMPTY' },
      { key: 'knowledge.indexer.jira-min-chars', label: 'Jira Min Text Length', description: 'Minimum combined character count (summary + description + comments) required to index an issue. Issues shorter than this are silently skipped without an embedding call.', defaultValue: '100', inputType: 'number', min: 0 },
      { key: 'knowledge.indexer.jira-quality-filter', label: 'Jira Claude Quality Filter', description: 'When enabled, a Claude Haiku call classifies each ticket as useful or not before embedding. Adds latency and API cost — enable only when the JQL and length filters are not sufficient.', defaultValue: 'false', inputType: 'boolean' },
      { key: 'knowledge.indexer.jira-quality-model', label: 'Jira Quality Filter Model', description: 'Claude model used for ticket quality scoring (only relevant when quality filter is enabled).', defaultValue: 'claude-haiku-4-5', inputType: 'select', options: ['claude-haiku-4-5', 'claude-haiku-3-5', ...CLAUDE_MODELS] },
      { key: 'knowledge.indexer.confluence-min-chars', label: 'Confluence Min Text Length', description: 'Minimum character count required to index a Confluence page. Pages shorter than this are silently skipped without an embedding call.', defaultValue: '200', inputType: 'number', min: 0 },
      { key: 'knowledge.indexer.confluence-quality-filter', label: 'Confluence Claude Quality Filter', description: 'When enabled, a Claude Haiku call classifies each Confluence page as useful or not before embedding. Adds latency and API cost — enable only when the length filter is not sufficient.', defaultValue: 'false', inputType: 'boolean' },
      { key: 'knowledge.indexer.confluence-quality-model', label: 'Confluence Quality Filter Model', description: 'Claude model used for Confluence page quality scoring (only relevant when quality filter is enabled).', defaultValue: 'claude-haiku-4-5', inputType: 'select', options: ['claude-haiku-4-5', 'claude-haiku-3-5', ...CLAUDE_MODELS] },
      { key: 'knowledge.indexer.max-attachment-bytes', label: 'Max Attachment Size (bytes)', description: 'Maximum attachment size in bytes that will be downloaded and indexed', defaultValue: '5242880', inputType: 'number', min: 1 },
      { key: 'knowledge.reindex.max-parallel', label: 'Webhook Reindex: Max Parallel', description: 'Number of concurrent threads for webhook-triggered reindexing of Jira issues and Confluence pages', defaultValue: '2', inputType: 'number', min: 1, max: 20 },
      { key: 'knowledge.reindex.max-queue-size', label: 'Webhook Reindex: Queue Size', description: 'Maximum pending webhook-triggered reindex tasks. Excess events are silently dropped — the next webhook or scheduled full reindex will catch them up', defaultValue: '50', inputType: 'number', min: 1 },
    ],
  },
  {
    id: 'knowledge-crawler',
    label: 'Web Docs Crawler',
    settings: [
      { key: 'knowledge.crawler.scheduler.enabled', label: 'Scheduler Enabled', description: 'Enable weekly Friday-night re-crawl of all registered web doc sources', defaultValue: 'false', inputType: 'boolean' },
      { key: 'knowledge.crawler.global-max-pages', label: 'Global Max Pages', description: 'Hard ceiling on total pages crawled across all sources (safety limit)', defaultValue: '2000', inputType: 'number', min: 1 },
      { key: 'knowledge.crawler.user-agent', label: 'User-Agent', description: 'HTTP User-Agent header sent by the crawler to documentation sites', defaultValue: 'code-agent-bot/1.0' },
      { key: 'knowledge.crawler.connect-timeout-ms', label: 'Connect Timeout (ms)', description: 'HTTP connection timeout per page fetch in milliseconds', defaultValue: '5000', inputType: 'number', min: 500, step: 500 },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    settings: [
      { key: 'teams.webhook.url', label: 'MS Teams Webhook URL', description: 'Incoming webhook URL for Microsoft Teams notifications' },
      { key: 'n8n.webhook.url', label: 'n8n Webhook URL', description: 'n8n automation webhook URL for custom notification workflows' },
      { key: 'agent.base.url', label: 'Agent Base URL', description: 'Externally reachable URL of the agent; used for automatic webhook registration' },
      { key: 'review.email.recipient', label: 'Review Email: Recipient', description: 'Email address that receives the PR review digest after each completed review. Leave blank to disable email notifications.' },
      { key: 'review.email.cc', label: 'Review Email: CC', description: 'Comma-separated list of additional email addresses to CC on every review digest (e.g. lead@example.com, qa@example.com). Leave blank for no CC.' },
      { key: 'review.email.from', label: 'Review Email: From Address', description: 'SES-verified sender address for review digest emails (e.g. code-agent@example.com). Must be verified in AWS SES.' },
      { key: 'review.email.aws.region', label: 'Review Email: AWS Region', description: 'AWS region for SES email sending. Must be a region where SES is available (e.g. eu-west-1, us-east-1).', defaultValue: 'eu-west-1' },
    ],
  },

  // ── AWS ───────────────────────────────────────────────────────────────────────
  {
    id: 'aws',
    label: 'AWS / Attachments',
    settings: [
      { key: 'tools.aws.enabled', label: 'AWS Tools Enabled', description: 'Enable AWS CloudWatch, ECS, and Metrics tools for the agent', defaultValue: 'true', inputType: 'boolean' },
      { key: 'attachment.s3.bucket', label: 'S3 Bucket', description: 'S3 bucket name used for storing file attachments (e.g. knowledge documents, PR diagrams)' },
      { key: 'attachment.s3.region', label: 'S3 Region', description: 'AWS region where the attachments bucket is located', defaultValue: 'us-east-1' },
      { key: 'attachment.max-file-size', label: 'Max File Size (bytes)', description: 'Maximum upload size per attachment in bytes', defaultValue: '10485760', inputType: 'number', min: 1024 },
      { key: 'attachment.allowed-types', label: 'Allowed MIME Types', description: 'Comma-separated list of permitted attachment MIME types', defaultValue: 'image/jpeg,image/png,image/gif,image/webp,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document', inputType: 'textarea' },
    ],
  },

  // ── Agent ─────────────────────────────────────────────────────────────────────
  {
    id: 'agent',
    label: 'Agent Behaviour',
    settings: [
      { key: 'run-fix.max-queue-size', label: 'Max Queue Size', description: 'Maximum non-review jobs that can wait in the in-memory queue before being failed. Review jobs are always backed by the DB.', defaultValue: '20', inputType: 'number', min: 1 },
      { key: 'run-fix.blocked-paths', label: 'Blocked Paths', description: 'Comma-separated paths the agent is not allowed to modify', defaultValue: 'src/main/security,src/main/billing,.github,.env', inputType: 'textarea' },
      { key: 'run-fix.allowed-commands', label: 'Allowed Commands', description: 'Comma-separated shell commands the agent is permitted to run', defaultValue: 'mvn,./mvnw,git diff,git status,git log,git add,git commit,ls,find,cat,grep,dotnet,npm,npx', inputType: 'textarea' },
      { key: 'run-fix.max-files-changed', label: 'Max Files Changed', description: 'Maximum number of files the agent may modify per job', defaultValue: '10', inputType: 'number', min: 1 },
      { key: 'run-fix.max-lines-changed', label: 'Max Lines Changed', description: 'Maximum lines the agent may change per job', defaultValue: '500', inputType: 'number', min: 1 },
      { key: 'run-fix.max-loop-iterations', label: 'Max Loop Iterations', description: 'Maximum agent loop cycles before the job is aborted', defaultValue: '150', inputType: 'number', min: 1 },
      { key: 'run-fix.job-timeout-minutes', label: 'Job Timeout (minutes)', description: 'Total wall-clock timeout per fix job', defaultValue: '30', inputType: 'number', min: 1 },
      { key: 'run-fix.max-build-retries', label: 'Max Build Retries', description: 'Number of times to retry a failing build before giving up', defaultValue: '2', inputType: 'number', min: 0 },
      { key: 'metrics.job-timeout-minutes', label: 'Metrics Job Timeout (minutes)', description: 'Total wall-clock timeout for a standalone metrics collection job', defaultValue: '30', inputType: 'number', min: 1 },
      { key: 'generate-tests.max-loop-iterations', label: 'Generate Tests: Max Iterations', description: 'Maximum agent loop cycles for a test-generation job', defaultValue: '500', inputType: 'number', min: 1 },
      { key: 'generate-tests.job-timeout-minutes', label: 'Generate Tests: Timeout (minutes)', description: 'Total wall-clock timeout for a test-generation job', defaultValue: '60', inputType: 'number', min: 1 },
      { key: 'generate-docs.max-loop-iterations', label: 'Generate Docs: Max Iterations', description: 'Maximum agent loop cycles for a documentation-generation job', defaultValue: '200', inputType: 'number', min: 1 },
      { key: 'build.java-home', label: 'Java Home', description: 'Path to the JDK installation used for building, linting (PMD/SpotBugs), and validation. Leave blank to use the JVM that runs the agent.' },
      { key: 'run-fix.self-review.enabled', label: 'Self-Review', description: 'Agent self-reviews its own changes before submitting', defaultValue: 'true', inputType: 'boolean' },
      { key: 'run-fix.self-review.max-iterations', label: 'Self-Review Max Iterations', description: 'Maximum self-review loop cycles', defaultValue: '15', inputType: 'number', min: 1 },
      { key: 'run-fix.self-review.max-diff-chars', label: 'Self-Review Max Diff Chars', description: 'Maximum diff size sent to self-review (characters)', defaultValue: '30000', inputType: 'number', min: 1000, step: 1000 },
      { key: 'tools.fetch-url.enabled', label: 'Fetch URL Tool', description: 'Allow the agent to fetch external documentation URLs', defaultValue: 'true', inputType: 'boolean' },
      { key: 'tools.fetch-url.timeout-seconds', label: 'Fetch URL Timeout (seconds)', description: 'Timeout for external URL fetches', defaultValue: '15', inputType: 'number', min: 1 },
      { key: 'tools.fetch-url.allowed-domains', label: 'Fetch URL Allowed Domains', description: 'Optional strict allowlist. Blank (default) = allow all public HTTPS. Reserved internal TLDs (.local, .internal, .corp, etc.) and private IPs are always blocked regardless of this setting.', defaultValue: '', inputType: 'textarea' },
    ],
  },
  {
    id: 'self-analysis',
    label: 'Self-Analysis',
    settings: [
      { key: 'self-analysis.enabled', label: 'Enabled', description: 'Automatically trigger a self-analysis job when a monitored job fails', defaultValue: 'false', inputType: 'boolean' },
      { key: 'self-analysis.trigger-job-types', label: 'Trigger Job Types', description: 'Comma-separated JobType values that trigger self-analysis on failure (e.g. FIX,GENERATE_TESTS)', defaultValue: 'FIX', inputType: 'textarea' },
      { key: 'self-analysis.product-id', label: 'Product ID', description: 'ProductConfig ID for the code-agent product (used to resolve repo URL and Jira project key)', defaultValue: '' },
      { key: 'self-analysis.environment-name', label: 'Environment Name', description: 'CloudWatch environment name to fetch logs from — must match an EnvironmentConfig.name on the customer record (e.g. "production")', defaultValue: '' },
      { key: 'self-analysis.log-group-name', label: 'Log Group Name', description: 'CloudWatch log group to query for code-agent logs (e.g. /ecs/code-agent)', defaultValue: '' },
      { key: 'self-analysis.job-timeout-minutes', label: 'Job Timeout (minutes)', description: 'Wall-clock timeout for a self-analysis job', defaultValue: '45', inputType: 'number', min: 5 },
      { key: 'self-analysis.max-loop-iterations', label: 'Max Loop Iterations', description: 'Maximum agent loop cycles for a self-analysis job', defaultValue: '150', inputType: 'number', min: 1 },
      { key: 'self-analysis.cooldown-hours', label: 'Cooldown (hours)', description: 'Do not re-trigger self-analysis for the same failed job if a successful analysis was produced within this many hours', defaultValue: '24', inputType: 'number', min: 0 },
    ],
  },
  {
    id: 'schedulers',
    label: 'Schedulers',
    settings: [
      { key: 'quality-report.scheduler.enabled', label: 'Quality Report Scheduler', description: 'Enable automated quality report collection', defaultValue: 'false', inputType: 'boolean' },
      { key: 'quality-report.branches', label: 'Quality Report Branches', description: 'Comma-separated branches to collect quality reports for', defaultValue: 'main,develop', inputType: 'textarea' },
      { key: 'quality-report.cc-threshold', label: 'Quality Report CC Threshold', description: 'Cyclomatic complexity threshold to flag in quality reports', defaultValue: '10', inputType: 'number', min: 1 },
      { key: 'quality-report.coverage.enabled', label: 'Quality Report Coverage', description: 'Enable coverage measurement during quality report collection', defaultValue: 'true', inputType: 'boolean' },
      { key: 'quality-report.job-timeout-minutes', label: 'Quality Report Timeout (minutes)', description: 'Timeout per quality report job', defaultValue: '30', inputType: 'number', min: 1 },
      { key: 'upgrade.scheduler.enabled', label: 'Upgrade Scheduler', description: 'Enable automated dependency upgrade jobs', defaultValue: 'false', inputType: 'boolean' },
      { key: 'upgrade.scheduler.default-branch', label: 'Upgrade Target Branch', description: 'Default branch for upgrade scheduler jobs', defaultValue: 'develop' },
      { key: 'upgrade.scheduler.version-cache-minutes', label: 'Version Cache (minutes)', description: 'How long to cache resolved dependency versions', defaultValue: '60', inputType: 'number', min: 1 },
      { key: 'code-graph.scheduler.enabled', label: 'Code Graph Scheduler', description: 'Enable automated code graph indexing', defaultValue: 'true', inputType: 'boolean' },
      { key: 'code-graph.scheduler.default-branch', label: 'Code Graph Default Branch', description: 'Branch to index for code graph', defaultValue: 'main' },
      { key: 'code-graph.scheduler.clone-timeout-minutes', label: 'Code Graph Clone Timeout (minutes)', description: 'Timeout for cloning a repository during code graph indexing', defaultValue: '10', inputType: 'number', min: 1 },
      { key: 'code-graph.cross-repo.enabled', label: 'Cross-Repo Analysis', description: 'Enable cross-repository dependency analysis in the code graph', defaultValue: 'true', inputType: 'boolean' },
      { key: 'code-graph.cross-repo.critical-threshold', label: 'Cross-Repo Critical Threshold', description: 'Number of repos using a symbol before it is labelled CRITICAL in impact analysis', defaultValue: '3', inputType: 'number', min: 1 },
      { key: 'hook.scheduler.enabled', label: 'Hook Scheduler', description: 'Enable cron-based automation hook evaluation', defaultValue: 'true', inputType: 'boolean' },
      { key: 'hook.scheduler.timezone', label: 'Hook Scheduler Timezone', description: 'Timezone for evaluating cron hook expressions (e.g. UTC, Europe/Berlin)', defaultValue: 'UTC' },
      { key: 'knowledge-graph.scheduler.enabled', label: 'Knowledge Graph Scheduler', description: 'Enable weekly knowledge graph computation across all repos', defaultValue: 'false', inputType: 'boolean' },
      { key: 'knowledge-graph.lookback-days', label: 'Knowledge Graph Lookback (days)', description: 'How far back in git history to analyse (default 365)', defaultValue: '365', inputType: 'number', min: 30 },
      { key: 'knowledge-graph.default-branch', label: 'Knowledge Graph Default Branch', description: 'Branch to clone for knowledge graph analysis', defaultValue: 'main' },
      { key: 'knowledge-graph.author-aliases', label: 'Author Identity Aliases', description: 'JSON map of email → canonical email for merging the same person\'s multiple git identities. Example: {"old@company.com":"canonical@company.com"}', defaultValue: '{}', inputType: 'textarea' },
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
      { key: 'rules.repo.url', label: 'Rules Repository URL', description: 'Git URL of a repository containing custom review rules. Leave blank to use only built-in rules.' },
      { key: 'review.pr-summary.enabled', label: 'PR Summary', description: 'Post a CodeRabbit-style PR summary before the review', defaultValue: 'true', inputType: 'boolean' },
      { key: 'review.sequence-diagrams.enabled', label: 'Sequence Diagrams in Summary', description: 'Include Mermaid sequence diagrams in PR summaries', defaultValue: 'true', inputType: 'boolean' },
      { key: 'pr.summary.diagram.upload.enabled', label: 'Upload Rendered Diagrams', description: 'Render Mermaid diagrams to PNG and upload them to the SCM platform rather than posting raw Mermaid source', defaultValue: 'true', inputType: 'boolean' },
      { key: 'review.fp.auto-suppress-threshold', label: 'False-Positive Auto-Suppress Threshold', description: 'Number of times the same finding must be dismissed before it is auto-suppressed for future reviews', defaultValue: '3', inputType: 'number', min: 1 },
      { key: 'metrics.cc-threshold', label: 'CC Threshold', description: 'Cyclomatic complexity threshold for flagging methods', defaultValue: '10', inputType: 'number', min: 1 },
      { key: 'metrics.max-iterations', label: 'Metrics Fix Iterations', description: 'Number of FIX → METRICS improvement cycles', defaultValue: '3', inputType: 'number', min: 1 },
      { key: 'metrics.max-methods-per-fix', label: 'Max Methods per Fix', description: 'High-CC methods to address per FIX step', defaultValue: '10', inputType: 'number', min: 1 },
      { key: 'planner.enabled', label: 'Planner', description: 'Enable AI task planning before code generation', defaultValue: 'true', inputType: 'boolean' },
      { key: 'planner.max-tokens', label: 'Planner Max Tokens', description: 'Max tokens for planner model response', defaultValue: '8192', inputType: 'number', min: 1024 },
    ],
  },

  // ── Scope (formerly Roadmap) ──────────────────────────────────────────────────
  {
    id: 'roadmap',
    label: 'Scope Reviews',
    settings: [
      { key: 'roadmap.review.model', label: 'Review Model', description: 'Claude model for Jira readiness reviews (leave blank to use primary model)', inputType: 'select', options: ['', ...CLAUDE_MODELS] },
      { key: 'roadmap.review.max-tokens', label: 'Max Tokens', description: 'Max output tokens for review responses', defaultValue: '4096', inputType: 'number', min: 512 },
      { key: 'roadmap.jira.epic-issuetype', label: 'Epic Issue Type', description: 'Jira issue type name for Epics', defaultValue: 'Epic' },
      { key: 'roadmap.jira.feature-issuetype', label: 'Feature Issue Type', description: 'Jira issue type name for Features', defaultValue: 'Story' },
      { key: 'roadmap.jira.userstory-issuetype', label: 'User Story Issue Type', description: 'Jira issue type name for User Stories', defaultValue: 'Sub-task' },
      { key: 'roadmap.jira.status-map.new', label: 'Status Map: New', description: 'Comma-separated Jira statuses mapped to "New"', defaultValue: 'To Do,Open,New', inputType: 'textarea' },
      { key: 'roadmap.jira.status-map.in-progress', label: 'Status Map: In Progress', description: 'Comma-separated Jira statuses mapped to "In Progress"', defaultValue: 'In Progress', inputType: 'textarea' },
      { key: 'roadmap.jira.status-map.qa', label: 'Status Map: QA', description: 'Comma-separated Jira statuses mapped to "QA"', defaultValue: 'In Review,QA,Testing', inputType: 'textarea' },
      { key: 'roadmap.jira.status-map.closed', label: 'Status Map: Closed', description: 'Comma-separated Jira statuses mapped to "Closed"', defaultValue: 'Done,Closed,Resolved', inputType: 'textarea' },
      { key: 'roadmap.delivery.readiness-threshold', label: 'Delivery Readiness Threshold', description: 'Minimum aggregate score (0–100) for an item to be marked "Ready for Delivery Team"', defaultValue: '70', inputType: 'number', min: 0, max: 100 },
      { key: 'roadmap.delivery.complexity-weight-enabled', label: 'Complexity-Weighted Aggregation', description: 'When enabled, child scores are weighted by their complexity score when rolling up to parent. Disable to use a simple average.', defaultValue: 'true', inputType: 'boolean' },
    ],
  },

  // ── Job Queue ─────────────────────────────────────────────────────────────────
  {
    id: 'job-queue',
    label: 'Job Queue',
    settings: [
      // Per-category concurrency
      { key: 'job.concurrency.chat',        label: 'Chat: Max Concurrent',           defaultValue: '10', inputType: 'number', min: 1, description: 'Max parallel CHAT jobs' },
      { key: 'job.concurrency.interactive', label: 'Interactive: Max Concurrent',     defaultValue: '10', inputType: 'number', min: 1, description: 'Max parallel REPLY / FIX_COMMENT / HOOK jobs' },
      { key: 'job.concurrency.pr-work',     label: 'PR Work: Max Concurrent',         defaultValue: '8',  inputType: 'number', min: 1, description: 'Max parallel REVIEW / FIX_PR / FIX jobs' },
      { key: 'job.concurrency.background',  label: 'Background: Max Concurrent',      defaultValue: '5',  inputType: 'number', min: 1, description: 'Max parallel METRICS / QUALITY_REPORT / SYNC_CONFLUENCE / GENERATE_* jobs' },
      { key: 'job.concurrency.roadmap',     label: 'Scope Review: Max Concurrent',  defaultValue: '20', inputType: 'number', min: 1, description: 'Max parallel REVIEW_EPIC / REVIEW_FEATURE / REVIEW_USERSTORY jobs' },
      // Per-type dispatch priorities
      { key: 'job.priority.chat',            label: 'Priority: CHAT',            defaultValue: '100', inputType: 'number', min: 1, max: 100, description: 'Dispatch priority 1–100 (higher = first). CHAT: interactive user session.' },
      { key: 'job.priority.reply',           label: 'Priority: REPLY',           defaultValue: '80',  inputType: 'number', min: 1, max: 100, description: 'Developer waiting on comment thread reply.' },
      { key: 'job.priority.fix_comment',     label: 'Priority: FIX_COMMENT',     defaultValue: '75',  inputType: 'number', min: 1, max: 100, description: 'Similar to REPLY, user-facing.' },
      { key: 'job.priority.review',          label: 'Priority: PR REVIEW',       defaultValue: '70',  inputType: 'number', min: 1, max: 100, description: 'PR review — developer blocked waiting.' },
      { key: 'job.priority.fix_pr',          label: 'Priority: FIX_PR',          defaultValue: '70',  inputType: 'number', min: 1, max: 100, description: 'PR fix — developer blocked waiting.' },
      { key: 'job.priority.fix',             label: 'Priority: FIX',             defaultValue: '60',  inputType: 'number', min: 1, max: 100, description: 'Developer-initiated code fix.' },
      { key: 'job.priority.hook',            label: 'Priority: HOOK',            defaultValue: '50',  inputType: 'number', min: 1, max: 100, description: 'Automation trigger — async, webhook caller does not wait for result.' },
      { key: 'job.priority.metrics',         label: 'Priority: METRICS',         defaultValue: '40',  inputType: 'number', min: 1, max: 100, description: 'Background analytics, no user waiting.' },
      { key: 'job.priority.quality_report',  label: 'Priority: QUALITY_REPORT',  defaultValue: '35',  inputType: 'number', min: 1, max: 100, description: 'Scheduled background report.' },
      { key: 'job.priority.sync_confluence', label: 'Priority: SYNC_CONFLUENCE', defaultValue: '30',  inputType: 'number', min: 1, max: 100, description: 'Background knowledge sync.' },
      { key: 'job.priority.generate_tests',  label: 'Priority: GENERATE_TESTS',  defaultValue: '25',  inputType: 'number', min: 1, max: 100, description: 'Background test generation.' },
      { key: 'job.priority.generate_docs',   label: 'Priority: GENERATE_DOCS',   defaultValue: '20',  inputType: 'number', min: 1, max: 100, description: 'Background doc generation.' },
      { key: 'job.priority.review_epic',     label: 'Priority: REVIEW_EPIC',     defaultValue: '15',  inputType: 'number', min: 1, max: 100, description: 'Batch scope review — low urgency background work.' },
      { key: 'job.priority.review_feature',  label: 'Priority: REVIEW_FEATURE',  defaultValue: '15',  inputType: 'number', min: 1, max: 100, description: 'Batch scope review — low urgency background work.' },
      { key: 'job.priority.review_userstory',label: 'Priority: REVIEW_USERSTORY',defaultValue: '15',  inputType: 'number', min: 1, max: 100, description: 'Batch scope review — low urgency background work.' },
      // Scope review queue refill
      { key: 'roadmap.review.refill-batch-size', label: 'Scope Review: Refill Batch Size', defaultValue: '10', inputType: 'number', min: 1, description: 'Jobs submitted to in-memory queue per scheduler tick (10 s).' },
    ],
  },

  // ── SOC II Compliance ─────────────────────────────────────────────────────────
  {
    id: 'soc2',
    label: 'SOC II Compliance',
    settings: [
      {
        key: 'soc2.protected-branches',
        label: 'Protected Branches',
        description: 'Comma-separated branches requiring a bot review before a Bug fix can be merged. Include both integration and production branches.',
        defaultValue: 'develop,main,master,production',
      },
      {
        key: 'soc2.bug-issue-types',
        label: 'Bug Issue Types',
        description: 'Comma-separated Jira issue types that trigger SOC II controls (review guard, evidence generation, deletion protection).',
        defaultValue: 'Bug,Defect',
      },
      {
        key: 'soc2.production-branch',
        label: 'Production Branch',
        description: 'The branch representing production. Bug fixes merged to a non-production protected branch will trigger an auto-promotion PR to this branch.',
        defaultValue: 'main',
      },
      {
        key: 'soc2.sla.critical-days',
        label: 'SLA: Critical (days)',
        description: 'Maximum calendar days from Jira ticket creation to merge for Critical priority bugs.',
        defaultValue: '5',
        inputType: 'number' as const,
        min: 1,
      },
      {
        key: 'soc2.sla.high-days',
        label: 'SLA: High (days)',
        description: 'Maximum calendar days from Jira ticket creation to merge for High priority bugs.',
        defaultValue: '20',
        inputType: 'number' as const,
        min: 1,
      },
      {
        key: 'scytale.api.key',
        label: 'Scytale API Key',
        description: 'API key for Scytale Custom Integration evidence upload.',
        isSecret: true,
      },
      {
        key: 'scytale.base.url',
        label: 'Scytale Base URL',
        description: 'Scytale API base URL (from the Custom Integration developer guide in your Scytale workspace).',
        defaultValue: '',
      },
      {
        key: 'scytale.cc8-control-id',
        label: 'Scytale CC8.1 Control ID',
        description: 'The internal Scytale control ID for CC8.1 (Change Management). Found in your Scytale workspace under Controls.',
        defaultValue: '',
      },
    ],
  },

  // ── Aikido ────────────────────────────────────────────────────────────────────
  {
    id: 'aikido',
    label: 'Aikido Security',
    settings: [
      { key: 'aikido.base.url', label: 'Base URL', description: 'Aikido API base URL', defaultValue: 'https://app.aikido.dev' },
      { key: 'aikido.client.id', label: 'Client ID', description: 'Aikido OAuth 2.0 client ID for API access' },
      { key: 'aikido.client.secret', label: 'Client Secret', description: 'Aikido OAuth 2.0 client secret for API access', isSecret: true },
      { key: 'aikido.jira.default-project', label: 'Default Jira Project', description: 'Fallback Jira project key used when creating Bug tickets for Aikido issues (e.g. PROJ). Only used if the repo-settings do not specify a project.' },
    ],
  },

  // ── Speech / Amazon Transcribe ────────────────────────────────────────────────────
  {
    id: 'transcribe',
    label: 'Speech Dictation (Amazon Transcribe)',
    settings: [
      {
        key: 'transcribe.region',
        label: 'AWS Region',
        description: 'AWS region for Amazon Transcribe Streaming. Must be a region where the service is available (e.g. eu-west-1, us-east-1). Uses the ECS task role — no extra credentials needed.',
        defaultValue: 'eu-west-1',
      },
      {
        key: 'transcribe.sample-rate',
        label: 'PCM Sample Rate (Hz)',
        description: 'Sample rate in Hz for raw PCM audio. OGG/Opus chunks from the browser are passed through as-is; this value is still required by the Transcribe API.',
        defaultValue: '16000',
        inputType: 'number' as const,
        min: 8000,
        max: 48000,
        step: 8000,
      },
    ],
  },

  // ── Keycloak Admin ──────────────────────────────────────────────────────────────
  {
    id: 'keycloak-admin',
    label: 'Keycloak Admin Client',
    settings: [
      { key: 'keycloak.admin.server-url', label: 'Server URL', description: 'Keycloak base URL (e.g. https://auth.example.com). Used to build the Admin REST API endpoint.' },
      { key: 'keycloak.admin.realm', label: 'Realm', description: 'Realm that both hosts the service account and contains the users to manage.', defaultValue: 'master' },
      { key: 'keycloak.admin.client-id', label: 'Client ID', description: 'Service account client ID with realm-management > view-users and manage-users roles.' },
      { key: 'keycloak.admin.client-secret', label: 'Client Secret', description: 'Client secret for the service account above. Stored encrypted.', isSecret: true },
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
  custom?: boolean
}

const TABS: TabDef[] = [
  { id: 'ai-models',       label: 'AI & Models',      groupIds: ['ai', 'bedrock'] },
  { id: 'source-ctrl',     label: 'Source Control',   groupIds: ['git', 'bitbucket', 'azuredevops', 'gitlab', 'github'] },
  { id: 'integrations',    label: 'Integrations',     groupIds: ['jira', 'confluence', 'xray', 'mcp', 'web-search', 'knowledge', 'knowledge-crawler', 'notifications', 'aikido', 'transcribe'] },
  { id: 'agent',           label: 'Agent',            groupIds: ['agent', 'self-analysis', 'job-queue', 'aws', 'schedulers', 'linter', 'review'] },
  { id: 'roadmap',         label: 'Scope',             groupIds: ['roadmap'] },
  { id: 'cloud-accounts',  label: 'Cloud Accounts',   groupIds: [], custom: true },
  { id: 'compliance',      label: 'Compliance',       groupIds: ['soc2'] },
  { id: 'security',        label: 'Security',         groupIds: ['keycloak-admin', 'security'] },
]

// ── Shared input styles ────────────────────────────────────────────────────────

const inputCls =
  'w-full h-8 px-3 text-sm font-mono rounded-[var(--border-radius-button-small)] border border-[var(--color-inputs-input-border)] bg-[var(--color-inputs-input-background)] text-[var(--color-fonts-font-color-primary)] focus:outline-none focus:border-[var(--color-buttons-button-primary)] placeholder:text-[var(--color-fonts-font-color-support)]'

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
          <Button
            variant="ghost"
            size="sm"
            title="Reset to default"
            onClick={() => onDelete(meta.key)}
            disabled={isDeleting}
            icon={<Trash2 size={13} />}
            className="hover:bg-[var(--color-tags-critical-background)] hover:text-[var(--color-tags-font-critical)]"
          />
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

          <Button
            variant="ghost"
            size="sm"
            title="Edit"
            onClick={startEdit}
            disabled={editing || isSaving}
            icon={<Pencil size={13} />}
          />

          {isOverridden && (
            <Button
              variant="ghost"
              size="sm"
              title="Reset to default"
              onClick={() => onDelete(meta.key)}
              disabled={isDeleting || editing}
              icon={<Trash2 size={13} />}
              className="hover:bg-[var(--color-tags-critical-background)] hover:text-[var(--color-tags-font-critical)]"
            />
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
                <Select
                  value={inputValue}
                  onChange={setInputValue}
                  options={(meta.options ?? []).map((opt): SelectOption => ({
                    value: opt,
                    label: opt === '' ? '— none (use primary) —' : opt,
                  }))}
                  placeholder="Select a value…"
                />
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSecret((v) => !v)}
                  icon={showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1"
                />
              )}
            </div>

            {/* Save / Cancel */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!inputValue.trim() || isSaving}
              title="Save"
              icon={<Check size={13} />}
              className="shrink-0"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={cancelEdit}
              title="Cancel"
              icon={<X size={13} />}
              className="shrink-0"
            />
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

// ── Cloud Accounts ─────────────────────────────────────────────────────────────

const CLOUD_ACCOUNT_TYPES: CloudAccountType[] = ['AWS', 'AZURE', 'GOOGLE', 'OTHER']

const TYPE_LABELS: Record<CloudAccountType, string> = {
  AWS: 'AWS',
  AZURE: 'Azure',
  GOOGLE: 'Google Cloud',
  OTHER: 'Other',
}

const TYPE_BADGE_COLORS: Record<CloudAccountType, string> = {
  AWS: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  AZURE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  GOOGLE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  OTHER: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
}

interface CredentialFieldDef {
  key: string
  label: string
  placeholder?: string
  isSecret: boolean
  multiline?: boolean
}

const CREDENTIAL_FIELDS: Record<CloudAccountType, CredentialFieldDef[]> = {
  AWS: [
    { key: 'awsKeyId',  label: 'Access Key ID',     placeholder: 'AKIAIOSFODNN7EXAMPLE', isSecret: false },
    { key: 'awsSecret', label: 'Secret Access Key',  placeholder: '••••••••',              isSecret: true },
  ],
  AZURE: [
    { key: 'tenantId',       label: 'Tenant ID',        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', isSecret: false },
    { key: 'subscriptionId', label: 'Subscription ID',  placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', isSecret: false },
    { key: 'clientId',       label: 'Client ID',        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', isSecret: false },
    { key: 'clientSecret',   label: 'Client Secret',    placeholder: '••••••••',                              isSecret: true },
  ],
  GOOGLE: [
    { key: 'serviceAccountJson', label: 'Service Account JSON', placeholder: '{ "type": "service_account", ... }', isSecret: true, multiline: true },
  ],
  OTHER: [
    { key: 'credential', label: 'Credential', placeholder: 'Provider-specific credential value', isSecret: true },
  ],
}

const MASKED = '****'

function isMasked(v?: string) {
  return v === MASKED
}

interface CloudAccountModalProps {
  initial?: CloudAccount
  onSave: (id: string, body: CloudAccount) => void
  onClose: () => void
  isSaving: boolean
}

function CloudAccountModal({ initial, onSave, onClose, isSaving }: CloudAccountModalProps) {
  const isEdit = !!initial
  const [id, setId] = useState(initial?.id ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [type, setType] = useState<CloudAccountType>(initial?.type ?? 'AWS')
  const [creds, setCreds] = useState<Record<string, string>>(initial?.credentials ?? {})
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  const fields = CREDENTIAL_FIELDS[type]

  function updateCred(key: string, value: string) {
    setCreds((prev) => ({ ...prev, [key]: value }))
  }

  function toggleShow(key: string) {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleTypeChange(t: CloudAccountType) {
    setType(t)
    setCreds({})
    setShowSecrets({})
  }

  function handleSubmit() {
    if (!id.trim() || !name.trim()) return
    // Strip out masked values so the server knows not to update them
    const cleanCreds: Record<string, string> = {}
    Object.entries(creds).forEach(([k, v]) => {
      if (!isMasked(v)) cleanCreds[k] = v
    })
    onSave(id.trim(), {
      id: id.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      credentials: Object.keys(cleanCreds).length > 0 ? cleanCreds : undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-cards-card-stroke)] shrink-0">
          <h2 className="text-sm font-semibold text-[var(--color-fonts-font-color-headings)] flex items-center gap-2">
            <Cloud size={15} />
            {isEdit ? `Edit — ${initial.name}` : 'Add Cloud Account'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} icon={<X size={16} />} />
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* ID */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-fonts-font-color-support)] mb-1">
              ID *
            </label>
            <Input
              className="w-full text-sm h-8"
              value={id}
              onChange={(e) => setId(e.target.value)}
              disabled={isEdit}
              placeholder="e.g. my-aws-prod"
              autoFocus={!isEdit}
            />
            {!isEdit && (
              <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
                Unique slug — cannot be changed after creation.
              </p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-fonts-font-color-support)] mb-1">
              Name *
            </label>
            <Input
              className="w-full text-sm h-8"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engie AWS Production"
              autoFocus={isEdit}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-fonts-font-color-support)] mb-1">
              Description
            </label>
            <Input
              className="w-full text-sm h-8"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-fonts-font-color-support)] mb-1">
              Type *
            </label>
            <Select
              value={type}
              onChange={(v) => handleTypeChange(v as CloudAccountType)}
              options={CLOUD_ACCOUNT_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
            />
          </div>

          {/* Provider-specific credentials */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-fonts-font-color-headings)] uppercase tracking-wide mb-3">
              Credentials
            </p>
            <div className="space-y-3">
              {fields.map((f) => {
                const val = creds[f.key] ?? ''
                const show = !!showSecrets[f.key]
                const masked = isMasked(val)
                return (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-[var(--color-fonts-font-color-support)] mb-1">
                      {f.label}
                      {f.isSecret && (
                        <span className="ml-1 text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                          encrypted
                        </span>
                      )}
                    </label>
                    {f.multiline ? (
                      <textarea
                        className={textareaCls}
                        value={masked ? '' : val}
                        onChange={(e) => updateCred(f.key, e.target.value)}
                        placeholder={masked ? '(stored — enter new value to replace)' : f.placeholder}
                        rows={4}
                      />
                    ) : (
                      <div className="relative">
                        <Input
                          type={f.isSecret && !show ? 'password' : 'text'}
                          className={`w-full text-sm h-8 ${f.isSecret ? 'pr-8' : ''}`}
                          value={masked ? '' : val}
                          onChange={(e) => updateCred(f.key, e.target.value)}
                          placeholder={masked ? '(stored — enter new value to replace)' : f.placeholder}
                        />
                        {f.isSecret && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleShow(f.key)}
                            icon={show ? <EyeOff size={13} /> : <Eye size={13} />}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1"
                          />
                        )}
                      </div>
                    )}
                    {masked && (
                      <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
                        Value stored. Leave blank to keep unchanged.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-cards-card-stroke)] shrink-0">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={isSaving}
            onClick={handleSubmit}
            disabled={!id.trim() || !name.trim() || isSaving}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

function CloudAccountsSection() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<CloudAccount | null>(null)
  const [toasts, setToasts] = useState<ToastMsg[]>([])

  function addToast(text: string, type: 'success' | 'error') {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, text, type }])
  }

  const { data: accounts, isLoading } = useQuery<CloudAccount[]>({
    queryKey: ['cloud-accounts'],
    queryFn: () => api.get('/cloud-accounts').then((r) => r.data).catch(() => []),
  })

  const saveMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CloudAccount }) =>
      api.put(`/cloud-accounts/${id}`, body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['cloud-accounts'] })
      addToast(`Cloud account "${id}" saved.`, 'success')
      setAddOpen(false)
      setEditAccount(null)
    },
    onError: (_err, { id }) => addToast(`Failed to save "${id}".`, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cloud-accounts/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['cloud-accounts'] })
      addToast(`Cloud account "${id}" deleted.`, 'success')
    },
    onError: (_data, id) => addToast(`Failed to delete "${id}".`, 'error'),
  })

  const list = Array.isArray(accounts) ? accounts : []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-[var(--color-fonts-font-color-support)]">
          Named cloud provider credentials used by the agent when accessing customer environments.
          Secrets are stored encrypted and never returned in plaintext.
        </p>
        <Button
          size="md"
          variant="primary"
          icon={<Plus size={13} />}
          className="shrink-0 ml-4"
          onClick={() => setAddOpen(true)}
        >
          Add Account
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-14 skeleton-shimmer rounded-[var(--border-radius-card)]" />
          ))}
        </div>
      )}

      {!isLoading && list.length === 0 && (
        <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] px-4 py-12 text-center text-sm text-[var(--color-fonts-font-color-support)]">
          No cloud accounts configured. Add one to get started.
        </div>
      )}

      {!isLoading && list.length > 0 && (
        <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)] overflow-hidden">
          {list.map((account, idx) => {
            const credCount = account.credentials ? Object.keys(account.credentials).length : 0
            return (
              <div
                key={account.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  idx < list.length - 1 ? 'border-b border-[var(--color-cards-card-stroke)]' : ''
                }`}
              >
                <Cloud size={16} className="text-[var(--color-fonts-font-color-support)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--color-fonts-font-color-headings)]">
                      {account.name}
                    </span>
                    <code className="text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">
                      {account.id}
                    </code>
                    <span className={`text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] ${TYPE_BADGE_COLORS[account.type]}`}>
                      {TYPE_LABELS[account.type]}
                    </span>
                    {credCount > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-[var(--border-radius-tag)] bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]">
                        {credCount} credential{credCount !== 1 ? 's' : ''} stored
                      </span>
                    )}
                  </div>
                  {account.description && (
                    <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
                      {account.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Edit"
                    onClick={() => setEditAccount(account)}
                    icon={<Pencil size={13} />}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Delete"
                    onClick={() => deleteMutation.mutate(account.id)}
                    disabled={deleteMutation.isPending}
                    icon={<Trash2 size={13} />}
                    className="hover:bg-[var(--color-tags-critical-background)] hover:text-[var(--color-tags-font-critical)]"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(addOpen || editAccount) && (
        <CloudAccountModal
          initial={editAccount ?? undefined}
          onSave={(id, body) => saveMutation.mutate({ id, body })}
          onClose={() => { setAddOpen(false); setEditAccount(null) }}
          isSaving={saveMutation.isPending}
        />
      )}

      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.text}
          variant={t.type}
          duration={3500}
          onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
        />
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
  }

  const { data: settingsList, isLoading } = useQuery<SystemSetting[]>({
    queryKey: ['system-settings'],
    queryFn: () => api.get('/settings').then((r) => r.data).catch(() => []),
  })

  const { data: claudeModelsData } = useQuery<{ id: string; displayName: string }[]>({
    queryKey: ['claude-models'],
    queryFn: () => api.get('/models/claude').then((r) => r.data).catch(() => []),
    staleTime: 5 * 60 * 1000,
  })

  const claudeModelOptions: string[] = useMemo(
    () => (claudeModelsData && claudeModelsData.length > 0 ? claudeModelsData.map((m) => m.id) : CLAUDE_MODELS),
    [claudeModelsData],
  )

  const effectiveGroups: SettingGroup[] = useMemo(
    () =>
      SETTING_GROUPS.map((group) => ({
        ...group,
        settings: group.settings.map((s) =>
          s.options === CLAUDE_MODELS
            ? { ...s, options: claudeModelOptions }
            : s.options && s.options.length > 1 && s.options[0] === '' && s.options.slice(1).join() === CLAUDE_MODELS.join()
              ? { ...s, options: ['', ...claudeModelOptions] }
              : s,
        ),
      })),
    [claudeModelOptions],
  )

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

  const effectiveGroupById = useMemo(
    () => new Map(effectiveGroups.map((g) => [g.id, g])),
    [effectiveGroups],
  )

  const lowerSearch = search.toLowerCase().trim()
  const isSearching = lowerSearch.length > 0

  const searchGroups = effectiveGroups.map((group) => ({
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
    .map((id) => effectiveGroupById.get(id))
    .filter((g): g is SettingGroup => !!g)

  const totalOverridden = overrides.size
  const totalSettings = effectiveGroups.reduce((n, g) => n + g.settings.length, 0)

  function tabOverrideCount(tab: TabDef) {
    return tab.groupIds
      .flatMap((id) => effectiveGroupById.get(id)?.settings ?? [])
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
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search all settings…"
          className="h-8 w-64 text-sm"
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
              {currentTab.custom ? (
                currentTab.id === 'cloud-accounts' ? (
                  <CloudAccountsSection />
                ) : null
              ) : (
                tabGroups.map((group, idx) => (
                  <SettingSection
                    key={group.id}
                    group={group}
                    defaultOpen={idx === 0}
                    {...sectionProps}
                  />
                ))
              )}
            </>
          )}
        </>
      )}

      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.text}
          variant={t.type}
          duration={3500}
          onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
        />
      ))}
    </main>
  )
}
