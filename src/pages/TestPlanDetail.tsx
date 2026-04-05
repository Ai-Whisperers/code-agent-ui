import React from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ArrowLeft, BookOpen, Target, GitBranch, ShieldAlert, FlaskConical,
  Network, BarChart3, LogIn, Flag, HelpCircle, CheckCircle2, AlertTriangle, Loader2,
  TestTube2, ExternalLink,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import type { BreadcrumbItem } from '@/components/ui/Breadcrumb'
import { IdPill } from '@/components/shared/IdPill'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { RiskBadge } from '@/components/shared/RiskBadge'
import api from '@/lib/api'
import type {
  QaTestPlanRecord, FeatureTestPlan,
  StoryBehaviour, Risk, ConditionGroup, StoryCoverage, RiskCoverage, Gap,
  Clarification, ReadinessItem, TraceRow,
} from '@/types/api'

// ── Local badge helpers ───────────────────────────────────────────────────────

function CondTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    Positive: 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
    Negative: 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]',
    Boundary: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    'Edge Case': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    Security: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    Performance: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    'End-to-End': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    Integration: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    Data: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    Compliance: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  }
  const cls = map[type] ?? 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] ${cls}`}>
      {type}
    </span>
  )
}

function CoverageStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'Covered': 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
    'Fully Covered': 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]',
    'Partially Covered': 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]',
    'Partial': 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]',
    'Not Covered': 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]',
  }
  const cls = map[status] ?? 'bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]'
  return (
    <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] ${cls}`}>
      {status}
    </span>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ value, label, sub }: { value: number | string; label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)] p-4 text-center">
      <span className="text-3xl font-bold text-[var(--color-fonts-font-color-brand)]">{value}</span>
      <span className="mt-1 text-xs font-medium text-[var(--color-fonts-font-color-primary)]">{label}</span>
      {sub && <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">{sub}</span>}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ id, icon: Icon, title, children }: {
  id: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 flex flex-col gap-4">
      <h2 className="flex items-center gap-2.5 text-base font-semibold text-[var(--color-fonts-font-color-headings)]">
        <Icon size={16} className="shrink-0 text-[var(--color-fonts-font-color-brand)]" />
        {title}
      </h2>
      {children}
    </section>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] ${className}`}>
      {children}
    </div>
  )
}

function Divider() {
  return <hr className="border-[var(--color-cards-card-stroke)]" />
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fonts-font-color-support)] mb-2">
      {children}
    </p>
  )
}

// ── Section components ────────────────────────────────────────────────────────

function ExecSummary({ s }: { s: FeatureTestPlan['section01_executiveSummary'] }) {
  const childStories = s.childStories ?? []
  return (
    <Section id="exec-summary" icon={BookOpen} title={s.title}>
      <Card className="p-5 flex flex-col gap-4">
        <div>
          <SubHeading>Feature Overview</SubHeading>
          <p className="text-sm leading-relaxed text-[var(--color-fonts-font-color-primary)]">{s.featureOverview}</p>
        </div>
        {s.scope && (
          <>
            <Divider />
            <div>
              <SubHeading>Scope</SubHeading>
              <p className="text-sm leading-relaxed text-[var(--color-fonts-font-color-primary)]">{s.scope}</p>
            </div>
          </>
        )}
        <Divider />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard value={s.totalBehaviourTestConditions} label="Behaviour Test Conditions" />
          <KpiCard value={s.totalCapabilityTestConditions} label="Capability Test Conditions" />
          <KpiCard value={s.totalRisksIdentified} label="Risks Identified" />
          <KpiCard value={s.criticalClarificationsNeeded} label="Open Clarifications" sub="needing action" />
        </div>
        {childStories.length > 0 && (
          <>
            <Divider />
            <div>
              <SubHeading>Child Stories ({childStories.length})</SubHeading>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-tables-table-header-background)]">
                      {['Story ID', 'Summary', 'Status', 'Priority'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-[var(--color-fonts-font-color-support)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {childStories.map((story) => (
                      <tr key={story.storyId} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                        <td className="px-3 py-2"><IdPill id={story.storyId} /></td>
                        <td className="px-3 py-2 text-[var(--color-fonts-font-color-primary)]">{story.summary}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {story.status}
                          </span>
                        </td>
                        <td className="px-3 py-2"><PriorityBadge priority={story.priority} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        <Divider />
        <div>
          <SubHeading>Test Approach</SubHeading>
          <p className="text-sm leading-relaxed text-[var(--color-fonts-font-color-primary)]">{s.testApproach}</p>
        </div>
      </Card>
    </Section>
  )
}

function CapabilitySection({ s }: { s: FeatureTestPlan['section02_featureCapabilityBreakdown'] }) {
  const colors = [
    'text-[var(--color-fonts-font-color-brand)] border-l-[var(--color-fonts-font-color-brand)]',
    'text-cyan-600 border-l-cyan-500',
    'text-emerald-600 border-l-emerald-500',
    'text-violet-600 border-l-violet-500',
    'text-amber-600 border-l-amber-500',
    'text-rose-600 border-l-rose-500',
  ]
  return (
    <Section id="capabilities" icon={Target} title={s.title}>
      <Card className="p-5">
        <p className="text-sm mb-4 text-[var(--color-fonts-font-color-support)]">{s.businessOutcome}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {s.capabilityAreas.map((ca, i) => {
            const colorCls = colors[i % colors.length]
            return (
              <div
                key={ca.capabilityAreaId}
                className={`rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-page-background)] p-4 flex flex-col gap-2 border-l-4 ${colorCls.split(' ')[1]}`}
              >
                <div className="flex items-center gap-2">
                  <code className={`text-[11px] font-mono font-bold ${colorCls.split(' ')[0]}`}>{ca.capabilityAreaId}</code>
                  <span className="text-xs font-semibold text-[var(--color-fonts-font-color-primary)]">{ca.name}</span>
                </div>
                <p className="text-xs leading-relaxed text-[var(--color-fonts-font-color-support)]">{ca.description}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {ca.relatedStories.map((s) => <IdPill key={s} id={s} />)}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </Section>
  )
}

function BehavioursSection({ s }: { s: FeatureTestPlan['section03_storyBehaviourBreakdown'] }) {
  return (
    <Section id="behaviours" icon={GitBranch} title={s.title}>
      <div className="flex flex-col gap-3">
        {s.stories.map((story: StoryBehaviour) => (
          <Card key={story.storyId}>
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 list-none select-none">
                <div className="flex items-center gap-3 min-w-0">
                  <IdPill id={story.storyId} />
                  <span className="text-sm font-medium truncate text-[var(--color-fonts-font-color-primary)]">{story.summary}</span>
                </div>
                <span className="text-xs shrink-0 text-[var(--color-fonts-font-color-support)]">
                  {story.behaviours.length} behaviours
                </span>
              </summary>
              <div className="px-4 pb-4 flex flex-col gap-4 border-t border-[var(--color-cards-card-stroke)]">
                <div className="pt-4">
                  <SubHeading>Behaviours</SubHeading>
                  <div className="flex flex-col gap-2">
                    {story.behaviours.map((b) => (
                      <div key={b.behaviourId} className="flex items-start gap-3 text-sm">
                        <IdPill id={b.behaviourId} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[var(--color-fonts-font-color-primary)]">{b.description}</p>
                          <p className="text-[11px] mt-0.5 text-[var(--color-fonts-font-color-support)]">Source: {b.source}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {story.businessRules.length > 0 && (
                  <div>
                    <SubHeading>Business Rules</SubHeading>
                    <ul className="flex flex-col gap-1">
                      {story.businessRules.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-fonts-font-color-support)]">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          </Card>
        ))}
      </div>
    </Section>
  )
}

function RisksSection({ s }: { s: FeatureTestPlan['section04_riskAssessment'] }) {
  return (
    <Section id="risks" icon={ShieldAlert} title={s.title}>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-tables-table-header-background)]">
                {['ID', 'Description', 'Likelihood', 'Impact', 'Level', 'Mitigation'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[var(--color-fonts-font-color-support)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.risks.map((r: Risk) => (
                <tr key={r.riskId} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                  <td className="px-4 py-3"><IdPill id={r.riskId} /></td>
                  <td className="px-4 py-3 max-w-sm">
                    <p className="text-[var(--color-fonts-font-color-primary)]">{r.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.impactedCapabilities.map((c) => (
                        <span key={c} className="text-[10px] rounded px-1 py-0.5 bg-[var(--color-tags-neutral-background)] text-[var(--color-tags-font-neutral)]">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={r.likelihood} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={r.impact} /></td>
                  <td className="px-4 py-3"><RiskBadge level={r.riskLevel} /></td>
                  <td className="px-4 py-3 max-w-xs text-[var(--color-fonts-font-color-support)]">{r.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Section>
  )
}

function TestConditionsSection({
  id, icon: Icon, title, groups,
}: {
  id: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  groups: ConditionGroup[]
}) {
  return (
    <Section id={id} icon={Icon} title={title}>
      <div className="flex flex-col gap-3">
        {groups.map((group, gi) => {
          const groupKey = group.storyId ?? group.capabilityArea ?? String(gi)
          const groupLabel = group.storySummary
            ? `${group.storyId} — ${group.storySummary}`
            : (group.capabilityArea ?? groupKey)
          return (
            <Card key={groupKey}>
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 list-none select-none">
                  <div className="flex items-center gap-3 min-w-0">
                    <IdPill id={group.storyId ?? group.capabilityArea ?? ''} />
                    <span className="text-sm font-medium truncate text-[var(--color-fonts-font-color-primary)]">
                      {group.storySummary ?? group.capabilityArea ?? groupLabel}
                    </span>
                  </div>
                  <span className="text-xs shrink-0 text-[var(--color-fonts-font-color-support)]">
                    {group.conditions.length} conditions
                  </span>
                </summary>
                <div className="border-t border-[var(--color-cards-card-stroke)]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[var(--color-tables-table-header-background)]">
                        {['ID', 'Description', 'Type', 'Priority', 'Risk'].map((h) => (
                          <th key={h} className="px-4 py-2 text-left font-semibold text-[var(--color-fonts-font-color-support)]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.conditions.map((c) => (
                        <tr key={c.testConditionId} className="border-t border-[var(--color-tables-table-cell-stroke)]">
                          <td className="px-4 py-2.5"><IdPill id={c.testConditionId} /></td>
                          <td className="px-4 py-2.5 max-w-md text-[var(--color-fonts-font-color-primary)]">
                            {c.description}
                            {c.behaviourId && (
                              <p className="text-[10px] mt-0.5 text-[var(--color-fonts-font-color-support)]">
                                Behaviour: {c.behaviourId}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2.5"><CondTypeBadge type={c.type} /></td>
                          <td className="px-4 py-2.5"><PriorityBadge priority={c.priority} /></td>
                          <td className="px-4 py-2.5">
                            {c.riskLink && c.riskLink !== 'None' ? (
                              <IdPill id={c.riskLink} />
                            ) : (
                              <span className="text-[var(--color-fonts-font-color-support)]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </Card>
          )
        })}
      </div>
    </Section>
  )
}

function TraceabilitySection({ s }: { s: FeatureTestPlan['section07_traceabilityMatrix'] }) {
  return (
    <Section id="traceability" icon={Network} title={s.title}>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-tables-table-header-background)]">
                {['Feature', 'Capability', 'Story', 'Behaviours', 'Test Conditions', 'Risks', 'Coverage'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[var(--color-fonts-font-color-support)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.matrix.map((row: TraceRow, i) => (
                <tr key={i} className="border-b border-[var(--color-tables-table-cell-stroke)]">
                  <td className="px-4 py-2.5"><IdPill id={row.featureId} /></td>
                  <td className="px-4 py-2.5 text-[var(--color-fonts-font-color-support)]">{row.capabilityArea}</td>
                  <td className="px-4 py-2.5"><IdPill id={row.storyId} /></td>
                  <td className="px-4 py-2.5 text-[var(--color-fonts-font-color-support)] text-[10px]">{row.behaviourId}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {row.testConditionIds.map((id) => <IdPill key={id} id={id} />)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {row.riskIds.map((id) => <IdPill key={id} id={id} />)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><CoverageStatusBadge status={row.coverageStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </Section>
  )
}

function CoverageSection({ s }: { s: FeatureTestPlan['section08_coverageAnalysis'] }) {
  return (
    <Section id="coverage" icon={BarChart3} title={s.title}>
      <div className="flex flex-col gap-4">
        {/* Story coverage */}
        <Card>
          <div className="p-4 border-b border-[var(--color-cards-card-stroke)]">
            <SubHeading>Story Coverage</SubHeading>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--color-tables-table-header-background)]">
                  {['Story', 'Behaviours Covered', 'Test Conditions', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-semibold text-[var(--color-fonts-font-color-support)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.storyCoverageStatus.map((sc: StoryCoverage) => (
                  <tr key={sc.storyId} className="border-t border-[var(--color-tables-table-cell-stroke)]">
                    <td className="px-4 py-2.5"><IdPill id={sc.storyId} /></td>
                    <td className="px-4 py-2.5 text-[var(--color-fonts-font-color-primary)]">{sc.behavioursCovered}</td>
                    <td className="px-4 py-2.5 text-[var(--color-fonts-font-color-primary)] tabular-nums">{sc.testConditions}</td>
                    <td className="px-4 py-2.5"><CoverageStatusBadge status={sc.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Risk coverage */}
        {s.riskCoverageStatus.length > 0 && (
          <Card>
            <div className="p-4 border-b border-[var(--color-cards-card-stroke)]">
              <SubHeading>Risk Coverage</SubHeading>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--color-tables-table-header-background)]">
                    {['Risk', 'Level', 'Behaviour Tests', 'Capability Tests', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left font-semibold text-[var(--color-fonts-font-color-support)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.riskCoverageStatus.map((rc: RiskCoverage) => (
                    <tr key={rc.riskId} className="border-t border-[var(--color-tables-table-cell-stroke)]">
                      <td className="px-4 py-2.5"><IdPill id={rc.riskId} /></td>
                      <td className="px-4 py-2.5"><RiskBadge level={rc.riskLevel} /></td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(rc.coveredByBehaviourTests ?? []).map((id) => <IdPill key={id} id={id} />)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(rc.coveredByCapabilityTests ?? []).map((id) => <IdPill key={id} id={id} />)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5"><CoverageStatusBadge status={rc.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Gaps */}
        {s.gaps.length > 0 && (
          <Card className="p-5">
            <SubHeading>Coverage Gaps ({s.gaps.length})</SubHeading>
            <div className="flex flex-col gap-3">
              {s.gaps.map((gap: Gap) => (
                <div key={gap.gapId} className="flex items-start gap-3 p-3 rounded-[var(--border-radius-card)] bg-[var(--color-tags-attention-background)] border border-[var(--color-tags-attention-background)]">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-[var(--color-tags-font-attention)]" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <IdPill id={gap.gapId} />
                      <RiskBadge level={gap.severity} />
                    </div>
                    <p className="text-xs text-[var(--color-fonts-font-color-primary)]">{gap.description}</p>
                    <p className="text-xs mt-1 text-[var(--color-fonts-font-color-support)]">
                      Recommendation: {gap.recommendation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Section>
  )
}

function EntryExitSection({ s }: { s: FeatureTestPlan['section10_entryExitCriteria'] }) {
  return (
    <Section id="entry-exit" icon={LogIn} title={s.title}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <SubHeading>Entry Criteria</SubHeading>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-medium text-[var(--color-fonts-font-color-primary)] mb-1">Behaviour Testing</p>
              <ul className="flex flex-col gap-1">
                {s.entryCriteria.behaviourTesting.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-fonts-font-color-support)]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />{c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--color-fonts-font-color-primary)] mb-1">Capability Testing</p>
              <ul className="flex flex-col gap-1">
                {s.entryCriteria.capabilityTesting.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-fonts-font-color-support)]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />{c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <SubHeading>Exit Criteria</SubHeading>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Behaviour Testing', items: s.exitCriteria.behaviourTesting },
              { label: 'Capability Testing', items: s.exitCriteria.capabilityTesting },
              { label: 'Feature Quality Gate', items: s.exitCriteria.featureQualityGate },
            ].map(({ label, items }) => (
              <div key={label}>
                <p className="text-xs font-medium text-[var(--color-fonts-font-color-primary)] mb-1">{label}</p>
                <ul className="flex flex-col gap-1">
                  {items.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-fonts-font-color-support)]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />{c}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Section>
  )
}

function ReadinessSection({ s }: { s: FeatureTestPlan['section13_readinessForTestCaseDesign'] }) {
  const r = s.readinessAssessment
  const readyCls = r.overallReadiness === 'Ready'
    ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
    : r.overallReadiness === 'Ready with Caveats'
      ? 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]'
      : 'bg-[var(--color-tags-critical-background)] text-[var(--color-tags-font-critical)]'

  return (
    <Section id="readiness" icon={Flag} title={s.title}>
      <Card className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">Overall Readiness:</span>
          <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-[var(--border-radius-tag)] ${readyCls}`}>
            {r.overallReadiness}
          </span>
        </div>
        {r.blockers.length > 0 && (
          <div>
            <SubHeading>Blockers</SubHeading>
            <ul className="flex flex-col gap-1">
              {r.blockers.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-tags-font-critical)]">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />{b}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Divider />
        <div>
          <SubHeading>Per-Story Readiness</SubHeading>
          <div className="flex flex-col gap-2">
            {r.readyForTestCaseDesign.map((item: ReadinessItem) => (
              <div key={item.storyId} className="flex items-start gap-3">
                {item.ready
                  ? <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-[var(--color-tags-font-success)]" />
                  : <AlertTriangle size={14} className="shrink-0 mt-0.5 text-[var(--color-tags-font-attention)]" />}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <IdPill id={item.storyId} />
                    <span className="text-xs text-[var(--color-fonts-font-color-primary)]">
                      {item.ready ? 'Ready' : 'Not Ready'}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-xs mt-0.5 text-[var(--color-fonts-font-color-support)]">{item.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </Section>
  )
}

function ClarificationsSection({ s }: { s: FeatureTestPlan['section14_clarificationsNeeded'] }) {
  if (!s.clarifications?.length) return null
  return (
    <Section id="clarifications" icon={HelpCircle} title={s.title}>
      <div className="flex flex-col gap-3">
        {s.clarifications.map((c: Clarification) => (
          <Card key={c.clarificationId} className="p-4">
            <div className="flex items-start gap-3">
              <HelpCircle size={14} className="shrink-0 mt-0.5 text-[var(--color-fonts-font-color-support)]" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <IdPill id={c.clarificationId} />
                  <PriorityBadge priority={c.priority} />
                  <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-[var(--border-radius-tag)] ${
                    c.status === 'Resolved'
                      ? 'bg-[var(--color-tags-success-background)] text-[var(--color-tags-font-success)]'
                      : 'bg-[var(--color-tags-attention-background)] text-[var(--color-tags-font-attention)]'
                  }`}>
                    {c.status}
                  </span>
                  <span className="text-[10px] text-[var(--color-fonts-font-color-support)]">
                    Related: {c.relatedTo}
                  </span>
                </div>
                <p className="text-sm font-medium text-[var(--color-fonts-font-color-primary)]">{c.question}</p>
                <p className="text-xs mt-1 text-[var(--color-fonts-font-color-support)]">Impact: {c.impact}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  )
}

// ── Sticky nav ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'exec-summary', label: 'Summary' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'behaviours', label: 'Behaviours' },
  { id: 'risks', label: 'Risks' },
  { id: 'behaviour-tcs', label: 'Behaviour TCs' },
  { id: 'capability-tcs', label: 'Capability TCs' },
  { id: 'traceability', label: 'Traceability' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'entry-exit', label: 'Entry/Exit' },
  { id: 'readiness', label: 'Readiness' },
  { id: 'clarifications', label: 'Clarifications' },
]

function StickyNav() {
  return (
    <nav className="sticky top-0 z-20 bg-[var(--color-page-background)] border-b border-[var(--color-borders-border-primary)] -mx-4 px-4 py-2 mb-6 overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="px-3 py-1 text-xs font-medium rounded-[var(--border-radius-tag)] text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)] transition-colors whitespace-nowrap"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface TestPlanDetailProps {
  scopeId: string
  issueKey: string
}

export default function TestPlanDetail({ scopeId, issueKey }: TestPlanDetailProps) {
  const navigate = useNavigate()
  const [toast, setToast] = React.useState<{ message: string; variant: 'success' | 'error' | 'info' } | null>(null)

  const { data: record, isLoading, isError } = useQuery<QaTestPlanRecord>({
    queryKey: ['qa-test-plan', scopeId, issueKey],
    queryFn: () => {
      // When opened from the global test-plans list there is no scopeId; use the
      // by-key endpoint directly. The scope-aware endpoint is used when navigating
      // from a QA scope detail page (adds the isStale field).
      const url = scopeId
        ? `/qa-scope/${scopeId}/features/${issueKey}/test-plan`
        : `/qa/test-plans/by-key/${issueKey}`
      return api.get(url).then((r) => r.data)
    },
    staleTime: 60_000,
  })

  const { data: testCaseCount } = useQuery<number>({
    queryKey: ['qa-test-case-count', record?.id],
    queryFn: async () => {
      if (!record?.id) return 0
      const r = await api.get(`/qa/test-plans/${record.id}/test-cases`)
      return Array.isArray(r.data) ? r.data.length : 0
    },
    enabled: !!record?.id && record?.testPlanStatus === 'json_ready',
    staleTime: 30_000,
  })

  const generateTestCasesMutation = useMutation({
    mutationFn: () => api.post(`/qa/test-plans/${record!.id}/test-cases/generate`),
    onSuccess: (res) => {
      const jobId = res.data?.jobId
      setToast({ message: `Test case generation queued (job ${jobId})`, variant: 'info' })
    },
    onError: () => setToast({ message: 'Failed to queue test case generation', variant: 'error' }),
  })

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'QA Scopes', to: '/qa/scope' },
    { label: scopeId, to: `/qa/scope/${scopeId}` },
    { label: issueKey },
  ]

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

  if (isError || !record) {
    return (
      <main>
        <div className="mb-4"><Breadcrumb items={breadcrumbs} /></div>
        <div className="text-center py-16 text-[var(--color-fonts-font-color-support)]">
          <AlertTriangle size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">Test plan not found</p>
          <button
            onClick={() => navigate({ to: `/qa/scope/${scopeId}` })}
            className="mt-3 flex items-center gap-1.5 mx-auto text-sm text-[var(--color-fonts-font-color-brand)] hover:underline"
          >
            <ArrowLeft size={14} /> Back to scope
          </button>
        </div>
      </main>
    )
  }

  if (!record.planJson) {
    return (
      <main>
        <div className="mb-4"><Breadcrumb items={breadcrumbs} /></div>
        <div className="text-center py-16 text-[var(--color-fonts-font-color-support)]">
          <FlaskConical size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No test plan JSON yet</p>
          <p className="text-sm">Generate the analysis and then run "Generate JSON" from the QA scope page.</p>
          <button
            onClick={() => navigate({ to: `/qa/scope/${scopeId}` })}
            className="mt-3 flex items-center gap-1.5 mx-auto text-sm text-[var(--color-fonts-font-color-brand)] hover:underline"
          >
            <ArrowLeft size={14} /> Back to scope
          </button>
        </div>
      </main>
    )
  }

  const plan = record.planJson
  const meta = plan.metadata

  return (
    <main>
      <div className="mb-4"><Breadcrumb items={breadcrumbs} /></div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-fonts-font-color-headings)]">
              {meta.documentTitle}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-fonts-font-color-support)]">
              <span>v{meta.version}</span>
              <span>·</span>
              <span>{meta.createdDate}</span>
              <span>·</span>
              <span>{meta.methodology}</span>
              {record.jiraIssueKey && (
                <>
                  <span>·</span>
                  <a
                    href={`#jira-${record.jiraIssueKey}`}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-mono font-semibold hover:underline"
                    title="Linked Jira Test Plan"
                  >
                    {record.jiraIssueKey}
                  </a>
                </>
              )}
              {record.isStale && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-[var(--color-tags-font-attention)]">
                    <AlertTriangle size={11} /> Requirements changed — regeneration recommended
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {record.testPlanStatus === 'json_ready' && (testCaseCount ?? 0) > 0 && (
              <button
                onClick={() => navigate({ to: `/qa/test-cases/${record.issueKey}` })}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-[var(--border-radius-button)] border border-[var(--color-cards-card-stroke)] text-[var(--color-fonts-font-color-primary)] hover:bg-[var(--color-cards-card-background-hover)] transition-colors"
              >
                <ExternalLink size={13} /> View Test Cases ({testCaseCount})
              </button>
            )}
            {record.testPlanStatus === 'json_ready' && (
              <button
                onClick={() => generateTestCasesMutation.mutate()}
                disabled={generateTestCasesMutation.isPending}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-[var(--border-radius-button)] bg-[var(--color-fonts-font-color-brand)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {generateTestCasesMutation.isPending
                  ? <Loader2 size={13} className="animate-spin" />
                  : <TestTube2 size={13} />}
                {(testCaseCount ?? 0) > 0 ? 'Regenerate Test Cases' : 'Generate Test Cases'}
              </button>
            )}
            <button
              onClick={() => navigate({ to: `/qa/scope/${scopeId}` })}
              className="flex items-center gap-1.5 text-sm text-[var(--color-fonts-font-color-support)] hover:text-[var(--color-fonts-font-color-primary)] transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-[var(--border-radius-card)] shadow-lg text-sm font-medium
          ${toast.variant === 'success' ? 'bg-green-600 text-white' : toast.variant === 'error' ? 'bg-red-600 text-white' : 'bg-[var(--color-fonts-font-color-brand)] text-white'}`}
        >
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <StickyNav />

      {/* Sections */}
      <div className="flex flex-col gap-10">
        <ExecSummary s={plan.section01_executiveSummary} />
        <CapabilitySection s={plan.section02_featureCapabilityBreakdown} />
        <BehavioursSection s={plan.section03_storyBehaviourBreakdown} />
        <RisksSection s={plan.section04_riskAssessment} />
        <TestConditionsSection
          id="behaviour-tcs"
          icon={FlaskConical}
          title={plan.section05_behaviourTestConditions.title}
          groups={plan.section05_behaviourTestConditions.testConditions}
        />
        <TestConditionsSection
          id="capability-tcs"
          icon={FlaskConical}
          title={plan.section06_capabilityTestConditions.title}
          groups={plan.section06_capabilityTestConditions.testConditions}
        />
        <TraceabilitySection s={plan.section07_traceabilityMatrix} />
        <CoverageSection s={plan.section08_coverageAnalysis} />
        <EntryExitSection s={plan.section10_entryExitCriteria} />
        <ReadinessSection s={plan.section13_readinessForTestCaseDesign} />
        <ClarificationsSection s={plan.section14_clarificationsNeeded} />
      </div>
    </main>
  )
}
