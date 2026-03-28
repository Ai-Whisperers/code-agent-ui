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
  | 'REVIEW_EPIC'
  | 'REVIEW_FEATURE'
  | 'REVIEW_USERSTORY'

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
  priority?: number
  jiraKey?: string
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

// ---- Code Graph ----

export interface CodeGraphStatus {
  workspace: string
  repoSlug: string
  lastUpdatedAt: string | null
  nodeCount: number
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
  triggerTypes?: string[]
  prEvent?: string
  branchPattern?: string
  cronExpr?: string
  actionType?: string
  prompt?: string
  jobName?: string
  newBranchName?: string
  ruleNames?: string[]
  extraRules?: string
  targetBranch?: string
  commitDirect?: boolean
  repoUrl?: string
  triggerFilter?: Record<string, string>
}

// ---- Hook Filter Autocomplete ----

export interface RepoOption {
  value: string
  workspace: string
  repoSlug: string
  displayName: string
}

// ---- Prompt Templates ----

export interface PromptTemplate {
  key: string
  content: string
  isOverride: boolean
}

// ---- Execution Plans ----

export type PlanStatus = 'DRAFT' | 'APPROVED' | 'EXECUTING' | 'PAUSED' | 'CANCELLED' | 'COMPLETED' | 'FAILED'

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
  archived?: boolean
  createdBy?: string
  planData?: {
    phases?: PlanPhase[]
  }
}

// ---- Quality Reports ----

export interface PackageLineCoverage {
  name: string
  linesCovered: number
  linesMissed: number
}

export interface CoverageSection {
  lineRate?: number
  branchRate?: number
  methodRate?: number
  classRate?: number
  linesCovered?: number
  linesMissed?: number
  branchesCovered?: number
  branchesMissed?: number
  methodsCovered?: number
  methodsMissed?: number
  classesCovered?: number
  classesMissed?: number
  packages?: PackageLineCoverage[]
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
  totalFindings: number
  resolvedByDeveloper: number
  resolutionRate: number
  falsePositives: number
  fpRate: number
  fpByCategory: Record<string, number>
  autoSuppressedPatterns: number
}

// ---- Developer Scorecard ----

export interface DeveloperEntry {
  author: string
  totalPrs: number
  totalFindings: number
  resolvedFindings: number
  resolutionRate: number
  lastPrAt?: string
}

export interface DeveloperScorecard {
  workspace: string
  repoSlug: string
  periodDays: number
  authors: DeveloperEntry[]
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
  type?: string
  aws?: AwsConfig
}

export interface TeamMember {
  name?: string
  email?: string
  jiraAccountId?: string
}

export interface CustomerConfig {
  customerId: string
  name: string
  cloudAccountId?: string
  environments?: EnvironmentConfig[]
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
  teams?: Record<string, TeamMember[]>
  metadata?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export interface UpsertCustomerRequest {
  name: string
  cloudAccountId?: string
  environments?: EnvironmentConfig[]
  metadata?: Record<string, unknown>
}

export interface UpsertProductRequest {
  customerId?: string
  displayName: string
  git?: GitConfig
  jira?: JiraProjectConfig
  confluence?: ConfluenceProductConfig
  teams?: Record<string, TeamMember[]>
  metadata?: Record<string, unknown>
}

// ---- Cloud Accounts ----

export type CloudAccountType = 'AWS' | 'AZURE' | 'GOOGLE' | 'OTHER'

export interface CloudAccount {
  id: string
  name: string
  description?: string
  type: CloudAccountType
  /** Credential keys are present but values are masked (****) in API responses */
  credentials?: Record<string, string>
  createdAt?: string
  updatedAt?: string
}

export interface UpsertCloudAccountRequest {
  name: string
  description?: string
  type: CloudAccountType
  credentials?: Record<string, string>
}

// ---- Roadmap review token stats ----

export interface ReviewTypeTokenStats {
  avgInputTokens: number
  avgOutputTokens: number
  sampleCount: number
}

export type ReviewTokenStats = Partial<Record<'REVIEW_EPIC' | 'REVIEW_FEATURE' | 'REVIEW_USERSTORY', ReviewTypeTokenStats>>

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
  webDocs: number
  staticFiles: number
}

export interface WebDocSource {
  id: string
  name: string
  baseUrl: string
  allowedPathPrefix: string
  maxPages: number
  crawlDelayMs: number
  lastCrawledAt: string | null
  lastCrawlChunks: number | null
  lastCrawlError: string | null
  createdAt: string
}

export interface WebDocSourceCreateRequest {
  name: string
  baseUrl: string
  allowedPathPrefix: string
  maxPages?: number
  crawlDelayMs?: number
}

export interface StaticFileSource {
  id: string
  name: string
  originalFilename: string
  contentType: string
  fileSize: number
  indexedAt: string | null
  chunkCount: number | null
  indexError: string | null
  createdAt: string
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

// ---- Conversation Context ----

export interface ConversationContext {
  conversationId: string
  customerIds: string[]
  productIds: string[]
  aikidoIssueIds: number[]
  jiraIssueKeys: string[]
  confluenceDocIds: string[]
  createdAt: string
  updatedAt: string
}

export interface UpdateContextRequest {
  customerIds?: string[]
  productIds?: string[]
  aikidoIssueIds?: number[]
  jiraIssueKeys?: string[]
  confluenceDocIds?: string[]
}

// Context Items for Selection Dialogs
export interface CustomerContextItem {
  customerId: string
  name: string
  metadataSummary: string
}

export interface ProductContextItem {
  productId: string
  displayName: string
  customerId?: string
  customerName?: string
}

export interface AikidoIssueContextItem {
  issueGroupId: number
  issueType: string
  severity: string
  packageName?: string
  cveId?: string
  repoName?: string
}

export interface JiraIssueContextItem {
  issueKey: string
  summary: string
  status?: string
  issueType?: string
  assignee?: string
}

export interface ConfluenceDocContextItem {
  pageId: string
  title: string
  spaceKey?: string
  spaceName?: string
  contentPreview?: string
}

// ---- Webhook Audit Log ----

export interface WebhookAuditEntry {
  id: number
  platform: string
  eventType: string
  workspace?: string
  repoSlug?: string
  prId?: string
  author?: string
  action: string
  hooksExecuted?: string[]
  payload?: string
  receivedAt: string
}

// ---- Scope (formerly Roadmap) ----

export type JiraReadinessStatus = 'New' | 'In Progress' | 'QA' | 'Closed'
export type ItemOverrideStatus = 'ACCEPTED' | 'REMOVED'
export type ReadinessLabel = 'poor' | 'needs_refinement' | 'ready_with_minor_improvements' | 'fully_ready'

export interface Scope {
  id: string
  name: string
  /** Ordered list of Jira labels for this scope. */
  labels: string[]
  /** First label — backward compat convenience field returned by the API. */
  label: string
  epicIssuetype: string
  featureIssuetype: string
  userstoryIssuetype: string
  createdAt: string
}

/** A single row in the live preview table returned by GET /scope/preview-labels */
export interface LabelPreviewItem {
  issueKey: string
  summary: string
  status?: string
}

/** @deprecated Use Scope */
export type Roadmap = Scope

export interface ScopeTreeItem {
  issueKey: string
  issueType: 'EPIC' | 'FEATURE' | 'USERSTORY'
  parentKey?: string
  grandparentKey?: string
  summary: string
  jiraStatus?: JiraReadinessStatus
  readinessScore?: number
  readinessLabel?: ReadinessLabel
  complexityScore?: number
  aggregateScore?: number
  readyForDelivery?: boolean
  improvementSummary?: string
  reviewedAt?: string
  /** ISO timestamp from Jira's `updated` field, populated during sync. */
  jiraModifiedAt?: string
  /** True when Jira was modified after the last AI review — review is stale. */
  isStale?: boolean
  overrideStatus?: ItemOverrideStatus
  overrideUpdatedBy?: string
  assignee?: string
  reporter?: string
  sprintName?: string
  sprintStart?: string
  sprintEnd?: string
  /** True for virtual epics injected to group unparented features */
  isVirtual?: boolean
}

/** @deprecated Use ScopeTreeItem */
export type RoadmapTreeItem = ScopeTreeItem

export interface ScopeSprintItem {
  issueKey: string
  issueType: 'FEATURE' | 'USERSTORY'
  summary: string
  parentKey?: string
  grandparentKey?: string
  jiraStatus?: string
  assignee?: string
  sprintStart?: string
  sprintEnd?: string
}

/** @deprecated Use ScopeSprintItem */
export type RoadmapSprintItem = ScopeSprintItem

export interface ScopeSprintGroup {
  sprintName: string
  sprintStart?: string
  sprintEnd?: string
  items: ScopeSprintItem[]
}

/** @deprecated Use ScopeSprintGroup */
export type RoadmapSprintGroup = ScopeSprintGroup

export type ScopeSprintView = ScopeSprintGroup[]

/** @deprecated Use ScopeSprintView */
export type RoadmapSprintView = ScopeSprintView

/** Minimal shape returned by GET /scope/{id}/products */
export interface ScopeLinkedProduct {
  productId: string
  displayName: string
  customerId?: string
}

/** @deprecated Use ScopeLinkedProduct */
export type RoadmapLinkedProduct = ScopeLinkedProduct

export interface ScopeProposal {
  id: string
  scopeId: string
  issueKey: string
  issueType: 'EPIC' | 'FEATURE' | 'USERSTORY'
  parentKey?: string
  proposedSummary?: string
  proposedDescription?: string
  proposedCriteria?: string
  proposedTechnical?: string
  aiExplanation?: string
  status: 'DRAFT' | 'ACCEPTED' | 'REJECTED'
  jiraResultKey?: string
  createdAt: string
  updatedAt: string
}

/** @deprecated Use ScopeProposal */
export type RoadmapProposal = ScopeProposal
