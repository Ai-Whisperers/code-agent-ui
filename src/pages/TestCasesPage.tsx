import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, FlaskConical, Target, AlertTriangle, Loader2, TestTube2,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import type { BreadcrumbItem } from '@/components/ui/Breadcrumb'
import { TestCaseCard } from '@/components/shared/TestCaseCard'
import api from '@/lib/api'
import type { QaTestCase, QaTestPlanRecord } from '@/types/api'

// ── KPI counter ───────────────────────────────────────────────────────────────

function KpiCounter({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] px-5 py-3 text-center min-w-[80px]">
      <span className="text-2xl font-bold text-[var(--color-fonts-font-color-brand)] tabular-nums">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-[var(--color-fonts-font-color-support)]">{label}</span>
    </div>
  )
}

// ── Story section ─────────────────────────────────────────────────────────────

function StorySection({ storyKey, cases, planId, jiraBaseUrl }: {
  storyKey: string
  cases: QaTestCase[]
  planId: string
  jiraBaseUrl?: string
}) {
  const behaviourCases = cases.filter((c) => c.testCaseType === 'Behaviour')
  const capabilityCases = cases.filter((c) => c.testCaseType === 'Capability')

  return (
    <div className="flex flex-col gap-4">
      {/* Story header */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-bold text-[var(--color-fonts-font-color-brand)]">{storyKey}</span>
        <span className="text-xs text-[var(--color-fonts-font-color-support)]">
          {cases.length} test case{cases.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          {behaviourCases.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-fonts-font-color-support)]">
              <FlaskConical size={10} /> {behaviourCases.length} B
            </span>
          )}
          {capabilityCases.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-fonts-font-color-support)]">
              <Target size={10} /> {capabilityCases.length} C
            </span>
          )}
        </div>
      </div>

      {/* Behaviour cases */}
      {behaviourCases.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-[var(--color-fonts-font-color-primary)]">
            <FlaskConical size={12} className="text-[var(--color-fonts-font-color-brand)]" />
            Behaviour Tests ({behaviourCases.length})
          </h3>
          {behaviourCases.map((tc) => (
            <TestCaseCard key={tc.id} tc={tc} planId={planId} jiraBaseUrl={jiraBaseUrl} />
          ))}
        </div>
      )}

      {/* Capability cases */}
      {capabilityCases.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-[var(--color-fonts-font-color-primary)]">
            <Target size={12} className="text-[var(--color-fonts-font-color-brand)]" />
            Capability Tests ({capabilityCases.length})
          </h3>
          {capabilityCases.map((tc) => (
            <TestCaseCard key={tc.id} tc={tc} planId={planId} jiraBaseUrl={jiraBaseUrl} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface TestCasesPageProps {
  issueKey: string
}

export default function TestCasesPage({ issueKey }: TestCasesPageProps) {
  const navigate = useNavigate()

  const { data: plan, isLoading: planLoading } = useQuery<QaTestPlanRecord>({
    queryKey: ['qa-test-plan-by-key', issueKey],
    queryFn: () => api.get(`/qa/test-plans/by-key/${issueKey}`).then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: cases = [], isLoading: casesLoading, isError } = useQuery<QaTestCase[]>({
    queryKey: ['qa-test-cases', plan?.id],
    queryFn: () => api.get(`/qa/test-plans/${plan!.id}/test-cases`).then((r) => r.data),
    enabled: !!plan?.id,
    staleTime: 30_000,
  })

  const featureKey = issueKey
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Test Plans', to: '/qa/test-plans' },
    { label: featureKey, to: `/qa/test-plans/${featureKey}` },
    { label: 'Test Cases' },
  ]

  const isLoading = planLoading || casesLoading

  if (isLoading) {
    return (
      <main>
        <div className="mb-4"><Breadcrumb items={breadcrumbs} /></div>
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-[var(--color-fonts-font-color-support)]" />
        </div>
      </main>
    )
  }

  if (isError) {
    return (
      <main>
        <div className="mb-4"><Breadcrumb items={breadcrumbs} /></div>
        <div className="text-center py-16 text-[var(--color-fonts-font-color-support)]">
          <AlertTriangle size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">Failed to load test cases</p>
          <button
            onClick={() => navigate({ to: `/qa/test-plans/${featureKey}` })}
            className="mt-3 flex items-center gap-1.5 mx-auto text-sm text-[var(--color-fonts-font-color-brand)] hover:underline"
          >
            <ArrowLeft size={14} /> Back to test plan
          </button>
        </div>
      </main>
    )
  }

  if (cases.length === 0) {
    return (
      <main>
        <div className="mb-4"><Breadcrumb items={breadcrumbs} /></div>
        <div className="text-center py-16 text-[var(--color-fonts-font-color-support)]">
          <TestTube2 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No test cases yet</p>
          <p className="text-sm">Use "Generate Test Cases" from the test plan page.</p>
          <button
            onClick={() => navigate({ to: `/qa/test-plans/${featureKey}` })}
            className="mt-3 flex items-center gap-1.5 mx-auto text-sm text-[var(--color-fonts-font-color-brand)] hover:underline"
          >
            <ArrowLeft size={14} /> Back to test plan
          </button>
        </div>
      </main>
    )
  }

  // Group by story key
  const byStory = cases.reduce<Record<string, QaTestCase[]>>((acc, tc) => {
    if (!acc[tc.storyKey]) acc[tc.storyKey] = []
    acc[tc.storyKey].push(tc)
    return acc
  }, {})

  const behaviourCount = cases.filter((c) => c.testCaseType === 'Behaviour').length
  const capabilityCount = cases.filter((c) => c.testCaseType === 'Capability').length
  const storiesCount = Object.keys(byStory).length

  return (
    <main>
      <div className="mb-4"><Breadcrumb items={breadcrumbs} /></div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-fonts-font-color-headings)]">
              Test Cases — {featureKey}
            </h1>
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mt-1">
              {storiesCount} stor{storiesCount !== 1 ? 'ies' : 'y'} · {cases.length} test case{cases.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => navigate({ to: `/qa/test-plans/${featureKey}` })}
            className="flex items-center gap-1.5 text-sm text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] shrink-0"
          >
            <ArrowLeft size={14} /> Back to test plan
          </button>
        </div>

        {/* KPI counters */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <KpiCounter value={cases.length} label="Total" />
          <KpiCounter value={behaviourCount} label="Behaviour" />
          <KpiCounter value={capabilityCount} label="Capability" />
          <KpiCounter value={storiesCount} label="Stories" />
        </div>
      </div>

      {/* Stories */}
      <div className="flex flex-col gap-10">
        {Object.entries(byStory).map(([storyKey, storyCases]) => (
          <StorySection
            key={storyKey}
            storyKey={storyKey}
            cases={storyCases}
            planId={plan?.id ?? ''}
          />
        ))}
      </div>
    </main>
  )
}
