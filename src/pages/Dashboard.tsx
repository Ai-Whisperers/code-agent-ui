import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Wrench, CheckCircle2, Clock, ListOrdered, TrendingUp, MessageCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useStore } from '@tanstack/react-store'
import { authStore } from '@/store/auth-store'
import api from '@/lib/api'
import type { AiCallSummary, AiCallSummaryByJobType, JobTypeSummary } from '@/types/api'

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent?: string
}) {
  return (
    <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--color-fonts-font-color-support)] uppercase tracking-wide">
          {label}
        </span>
        <span className={accent ?? 'text-[var(--color-icons-icon)]'}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-[var(--color-fonts-font-color-headings)]">{value}</p>
    </div>
  )
}

function JobTypeCard({ jobType }: { jobType: JobTypeSummary }) {
  return (
    <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-4 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-[var(--color-fonts-font-color-headings)]">
          {jobType.jobType.replace(/_/g, ' ')}
        </h4>
        <span className="text-xs text-[var(--color-fonts-font-color-support)]">
          {jobType.uniqueJobs} {jobType.uniqueJobs === 1 ? 'job' : 'jobs'}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-fonts-font-color-support)]">Total Tokens</span>
          <span className="font-medium text-[var(--color-fonts-font-color-primary)]">
            {jobType.totalTokens.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-fonts-font-color-support)]">Cost</span>
          <span className="font-medium text-[var(--color-fonts-font-color-primary)]">
            ${jobType.estimatedCostUsd.toFixed(3)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[var(--color-fonts-font-color-support)]">Calls</span>
          <span className="font-medium text-[var(--color-fonts-font-color-primary)]">
            {jobType.callCount}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const user = useStore(authStore, (s) => s.user)!
  const navigate = useNavigate()

  const { data: summary } = useQuery<AiCallSummary>({
    queryKey: ['ai-calls-summary'],
    queryFn: () => api.get('/stats/ai-calls/summary').then((r) => r.data),
    refetchInterval: 30_000,
  })

  const { data: summaryByJobType } = useQuery<AiCallSummaryByJobType>({
    queryKey: ['ai-calls-summary-by-job-type'],
    queryFn: () => api.get('/stats/ai-calls/summary-by-job-type').then((r) => r.data),
    refetchInterval: 30_000,
  })

  const firstName = user.name.split(' ')[0]

  return (
    <main>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Here's an overview of your Code Agent activity."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard
          label="Total AI Calls"
          value={summary?.totalCalls ?? '—'}
          icon={<Wrench size={18} />}
        />
        <StatCard
          label="Total Cost (USD)"
          value={summary?.totalCostUsd != null ? `$${summary.totalCostUsd.toFixed(2)}` : '—'}
          icon={<TrendingUp size={18} />}
          accent="text-[var(--color-status-border-neutral)]"
        />
        <StatCard
          label="Avg Cost / Job"
          value={summaryByJobType?.overallStats?.avgCostPerJobExcludingChat != null ? `$${summaryByJobType.overallStats.avgCostPerJobExcludingChat.toFixed(3)}` : (summary?.avgCostPerJob != null ? `$${summary.avgCostPerJob.toFixed(3)}` : '—')}
          icon={<CheckCircle2 size={18} />}
          accent="text-[var(--color-status-border-success)]"
        />
        <StatCard
          label="Chat Calls"
          value={summaryByJobType?.chatStats?.chatCalls ?? '—'}
          icon={<MessageCircle size={18} />}
          accent="text-[var(--color-status-border-info)]"
        />
        <StatCard
          label="Input Tokens"
          value={summary?.totalInputTokens != null ? summary.totalInputTokens.toLocaleString() : '—'}
          icon={<ListOrdered size={18} />}
        />
      </div>

      {/* Token Usage by Job Type */}
      {summaryByJobType?.jobTypeBreakdown && summaryByJobType.jobTypeBreakdown.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-4">Token Usage by Job Type</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summaryByJobType.jobTypeBreakdown
              .filter(item => item.jobType !== 'CHAT')
              .map((item) => (
                <JobTypeCard key={item.jobType} jobType={item} />
              ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
        <h3 className="mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'New Fix Job', to: '/jobs/new', variant: 'primary' },
            { label: 'View Jobs', to: '/jobs', variant: 'secondary' },
            { label: 'View Plans', to: '/plans', variant: 'secondary' },
            { label: 'Quality Reports', to: '/metrics/quality', variant: 'secondary' },
          ].map(({ label, to, variant }) => (
            <button
              key={to}
              onClick={() => navigate({ to })}
              className={`px-4 py-2 rounded-[var(--border-radius-button-small)] text-sm font-medium transition-colors ${
                variant === 'primary'
                  ? 'bg-[var(--color-buttons-button-primary)] text-white hover:bg-[var(--color-buttons-button-primary-hover)]'
                  : 'bg-[var(--color-buttons-button-back)] text-[var(--color-fonts-font-color-buttons)] hover:bg-[var(--color-buttons-button-back-hover)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent jobs */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3>Recent Jobs</h3>
          <button
            className="text-sm text-[var(--color-fonts-font-color-brand)] hover:underline"
            onClick={() => navigate({ to: '/jobs' })}
          >
            View all
          </button>
        </div>
        <RecentJobsList />
      </div>
    </main>
  )
}

function RecentJobsList() {
  const navigate = useNavigate()
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['recent-jobs'],
    queryFn: () => api.get('/jobs?limit=5').then((r) => r.data).catch(() => []),
    refetchInterval: 15_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 skeleton-shimmer rounded-[var(--border-radius-card)]" />
        ))}
      </div>
    )
  }

  const list = Array.isArray(jobs) ? jobs : []

  if (list.length === 0) {
    return (
      <div className="text-center py-10 text-[var(--color-fonts-font-color-support)]">
        <Clock size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">No recent jobs found. Trigger your first job!</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {list.map((job: { jobId: string; jobType: string; status: string; createdAt: string }) => (
        <button
          key={job.jobId}
          onClick={() => navigate({ to: '/jobs/$id', params: { id: job.jobId } })}
          className="w-full text-left bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] px-4 py-3 hover:bg-[var(--color-cards-card-background-hover)] transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">
              {job.jobType}
            </span>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-0.5">
            {new Date(job.createdAt).toLocaleString()}
          </p>
        </button>
      ))}
    </div>
  )
}

export function JobStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    SUCCESS: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
    FAILED: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]',
    RUNNING: 'bg-[var(--color-status-neutral-background)] text-[var(--color-fonts-font-color-brand)]',
    PENDING: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
    QUEUED: 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]',
    AWAITING_APPROVAL: 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]',
  }
  const cls = map[status] ?? 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-[var(--border-radius-tag)] ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
