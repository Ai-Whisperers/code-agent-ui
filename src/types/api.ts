// ---- Jobs ----

export type JobStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'

export type JobType =
  | 'FIX'
  | 'REVIEW'
  | 'FIX_PR'
  | 'REPLY'
  | 'FIX_COMMENT'
  | 'HOOK'
  | 'GENERATE_TESTS'
  | 'GENERATE_DOCS'
  | 'SYNC_CONFLUENCE'
  | 'METRICS'
  | 'QUALITY_REPORT'

export interface JobStatusResponse {
  jobId: string
  jobType: JobType
  status: JobStatus
  createdAt: string
  summary?: string
  errorMessage?: string
  prUrl?: string
  prId?: string
  filesChanged?: number
  linesChanged?: number
  queuePosition?: number
}

export interface RunFixRequest {
  repoUrl: string
  branchName?: string
  jiraKey?: string
  prompt?: string
  targetBranch?: string
  planId?: string
}

export interface ReviewPrRequest {
  repoUrl: string
  prId: string
}

export interface GenerateTestsRequest {
  repoUrl: string
  branchName?: string
  targetFiles?: string[]
}

export interface RejectRequest {
  reason: string
}

// ---- Repo Settings ----

export interface RepoSettings {
  id?: number
  workspace: string
  repoSlug: string
  reviewEnabled: boolean
  vectorEnabled: boolean
  docsEnabled: boolean
  upgradeEnabled: boolean
  qualityReportEnabled: boolean
  ruleNames?: string[]
  reviewPrompt?: string
  disabledHooks?: string[]
  confluenceSpaceKey?: string
  confluenceParentPageId?: string
  gitPlatformUrl?: string
  archetype?: string
  archetypeVersion?: string
  archived?: boolean
}

// ---- Automation Hooks ----

export interface AutomationHook {
  name: string
  enabled: boolean
  description?: string
  trigger?: string
  prompt?: string
}

// ---- Prompt Templates ----

export interface PromptTemplate {
  key: string
  content: string
  isOverride: boolean
}

// ---- Execution Plans ----

export type PlanStatus = 'DRAFT' | 'APPROVED' | 'RUNNING' | 'EXECUTING' | 'COMPLETED' | 'FAILED'

export interface PlanStep {
  stepId: string
  order: number
  title: string
  description?: string
  status: string
  errorMessage?: string | null
}

export interface PlanPhase {
  phaseOrder: number
  title: string
  steps: PlanStep[]
}

export interface ExecutionPlan {
  planId: string
  status: PlanStatus
  title: string
  summary?: string
  sourceType?: string
  sourceRef?: string
  repoUrl?: string
  targetBranch?: string
  createdAt: string
  updatedAt?: string
  approvedAt?: string
  errorMessage?: string
  prUrl?: string
  conversationId?: string
  markdownContent?: string
  workspacePath?: string
  planData?: {
    phases?: PlanPhase[]
  }
}

// ---- Quality Reports ----

export interface CoverageSection {
  lineRate?: number
  branchRate?: number
  methodRate?: number
  classRate?: number
  linesCovered?: number
  linesMissed?: number
  branchesCovered?: number
  branchesMissed?: number
}

export interface LinterSection {
  errorCount?: number
  warningCount?: number
  infoCount?: number
}

export interface QualityReport {
  reportId: string
  workspace: string
  repoSlug: string
  branch: string
  measuredAt: string
  score?: number
  coverage?: CoverageSection
  linter?: LinterSection
  aikido?: {
    totalIssues?: number
    criticalCount?: number
    highCount?: number
    mediumCount?: number
    lowCount?: number
    issueCount?: number
  }
  complexity?: {
    avgComplexity?: number
    maxComplexity?: number
    totalMethods?: number
    methodsAboveThreshold?: number
    threshold?: number
  }
  reviewQuality?: { avgScore?: number; totalReviews?: number }
}

// ---- AI Stats ----

export interface AiCallSummary {
  totalCalls: number | null
  totalInputTokens: number | null
  totalOutputTokens: number | null
  totalCostUsd: number | null
  avgCostPerJob: number | null
  avgCostPerJobExcludingChat?: number | null
  chatCalls?: number | null
}

export interface JobTypeSummary {
  jobType: string
  callCount: number
  totalTokens: number
  totalInputTokens: number
  totalOutputTokens: number
  uniqueJobs: number
  estimatedCostUsd: number
}

export interface AiCallSummaryByJobType {
  jobTypeBreakdown: JobTypeSummary[]
  overallStats: {
    totalCalls: number
    totalInputTokens: number
    totalOutputTokens: number
    totalCostUsd: number
    uniqueJobsExcludingChat: number
    avgCostPerJobExcludingChat: number
  }
  chatStats: {
    chatCalls: number
    totalInputTokens: number
    totalOutputTokens: number
    estimatedCostUsd: number
  }
}

export interface AiCallDailyStat {
  date: string
  calls: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface AiCallRecord {
  id: string
  jobId: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  costUsd: number
  calledAt: string
}

// ---- Review Metrics ----

export interface ReviewMetrics {
  workspace: string
  repoSlug: string
  totalReviews: number
  avgScore: number
  lastReviewAt?: string
}

// ---- Upgrades ----

export type LatestVersionsResponse = Record<string, string>

// ---- Memory ----

export interface MemoryEntry {
  id: string
  workspace: string
  repoSlug: string
  content: string
  createdAt: string
  active: boolean
}

// ---- Customer Registry ----

export interface GitConfig {
  platform: string
  workspace: string
  baseUrl?: string
}

export interface JiraProjectConfig {
  baseUrl?: string
  projects?: Record<string, string>
}

export interface ConfluenceProductConfig {
  spaceKey?: string
  rootPageId?: string
}

export interface AwsConfig {
  accountId?: string
  region?: string
  iamRole?: string
}

export interface EnvironmentConfig {
  name: string
  aws?: AwsConfig
  deployedRepos?: string[]
}

export interface TeamMember {
  name?: string
  email?: string
  jiraAccountId?: string
  slackId?: string
}

export interface CustomerConfig {
  customerId: string
  name: string
  metadata?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export interface ProductConfig {
  productId: string
  customerId?: string
  displayName: string
  git?: GitConfig
  jira?: JiraProjectConfig
  confluence?: ConfluenceProductConfig
  environments?: EnvironmentConfig[]
  teams?: Record<string, TeamMember[]>
  metadata?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export interface UpsertCustomerRequest {
  name: string
  metadata?: Record<string, unknown>
}

export interface UpsertProductRequest {
  customerId?: string
  displayName: string
  git?: GitConfig
  jira?: JiraProjectConfig
  confluence?: ConfluenceProductConfig
  environments?: EnvironmentConfig[]
  teams?: Record<string, TeamMember[]>
  metadata?: Record<string, unknown>
}

// ---- System Settings ----

export interface SystemSetting {
  key: string
  value: string
  isSecret: boolean
  description?: string
  updatedAt?: string
}

export interface UpsertSettingRequest {
  value: string
  isSecret: boolean
  description?: string
}

// ---- Knowledge Index ----

export interface KnowledgeStatEntry {
  sourceType: string
  count: number
  lastIndexed: string | null
}

export interface KnowledgeStatsResponse {
  jira: number
  confluence: number
  jiraAttachment: number
}

export interface KnowledgeIndexJiraRequest {
  projectKey: string
}

export interface KnowledgeIndexConfluenceRequest {
  spaceKey: string
}

export interface KnowledgeSearchResult {
  id: string
  sourceType: string
  title: string
  content: string
  score: number
  url?: string
}

export interface KnowledgeSearchResponse {
  results: KnowledgeSearchResult[]
  total: number
}

// ---- Chat ----

export interface ChatAttachment {
  id?: number
  attachmentId: string
  conversationId: string
  messageId?: number
  filename: string
  contentType: string
  fileSize: number
  s3Bucket: string
  s3Key: string
  uploadedAt: string
}

export interface ChatRequest {
  message: string
  productId?: string
  conversationId?: string
  attachmentIds?: string[]
}

export interface ChatEvent {
  type: 'text' | 'thinking' | 'tool_start' | 'tool_end' | 'plan_start' | 'plan_created' | 'plan_updated' | 'done' | 'error'
  text?: string
  tool?: string
  input?: Record<string, unknown>
  result?: string
  timestamp?: number
  error?: string
  conversationId?: string
  planId?: string
  title?: string
  status?: string
}

export type ThinkingStep =
  | { kind: 'thought'; text: string; timestamp?: number }
  | { kind: 'tool'; name: string; input?: Record<string, unknown>; result?: string; status: 'running' | 'completed' | 'error'; startTime: number; endTime?: number }

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinkingSteps?: ThinkingStep[]
}

export interface ConversationSummary {
  conversationId: string
  title: string
  productId?: string
  createdAt: string
  updatedAt: string
  messageCount: number
}
