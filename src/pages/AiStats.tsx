import { useQuery } from '@tanstack/react-query'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { PageHeader } from '@/components/layout/PageHeader'
import { TableCard } from '@/components/ui/TableCard'
import { Tooltip } from '@/components/ui/Tooltip'
import api from '@/lib/api'
import type { AiCallSummary, AiCallDailyStat, AiCallRecord } from '@/types/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend)

// Pricing per million tokens (USD). Matches Anthropic's published rates.
const MODEL_PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  default: { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 },
}

function calcCost(model: string, input: number, output: number, cacheWrite: number, cacheRead: number): number {
  const p = MODEL_PRICING[model] ?? MODEL_PRICING.default
  return (input * p.input + output * p.output + cacheWrite * p.cacheWrite + cacheRead * p.cacheRead) / 1_000_000
}

const BAR_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' as const } },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
    x: { grid: { display: false } },
  },
}

type RawSummaryItem = {
  callCount: number
  estimatedCostUsd: number
  uniqueJobs: number
  totalInputTokens: number
  totalOutputTokens: number
}

type RawDailyStat = {
  day: string
  callCount: number
  estimatedCostUsd: number
  totalInputTokens: number
  totalOutputTokens: number
}

type RawCallRecord = {
  id: number
  jobId: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  createdAt: string
}

export default function AiStatsPage() {
  const { data: summary } = useQuery<AiCallSummary>({
    queryKey: ['ai-calls-summary'],
    queryFn: () =>
      api.get('/stats/ai-calls/summary').then((r) => {
        const items: RawSummaryItem[] = Array.isArray(r.data) ? r.data : []
        const totalCalls = items.reduce((s, i) => s + i.callCount, 0)
        const totalCostUsd = items.reduce((s, i) => s + i.estimatedCostUsd, 0)
        const totalInputTokens = items.reduce((s, i) => s + i.totalInputTokens, 0)
        const totalOutputTokens = items.reduce((s, i) => s + i.totalOutputTokens, 0)
        const totalUniqueJobs = items.reduce((s, i) => s + i.uniqueJobs, 0)
        return {
          totalCalls,
          totalCostUsd,
          totalInputTokens,
          totalOutputTokens,
          avgCostPerJob: totalUniqueJobs > 0 ? totalCostUsd / totalUniqueJobs : null,
        } satisfies AiCallSummary
      }),
  })

  const { data: daily } = useQuery<AiCallDailyStat[]>({
    queryKey: ['ai-calls-daily'],
    queryFn: () =>
      api
        .get('/stats/ai-calls/daily')
        .then((r) =>
          (r.data as RawDailyStat[]).map((d) => ({
            date: d.day,
            calls: d.callCount,
            inputTokens: d.totalInputTokens,
            outputTokens: d.totalOutputTokens,
            costUsd: d.estimatedCostUsd,
          })),
        )
        .catch(() => []),
  })

  const { data: records } = useQuery<{ items: AiCallRecord[]; total: number }>({
    queryKey: ['ai-calls-records'],
    queryFn: () =>
      api
        .get('/stats/ai-calls?page=0&size=20')
        .then((r) => {
          const raw: RawCallRecord[] = Array.isArray(r.data) ? r.data : (r.data?.items ?? [])
          return {
            items: raw.map((rec) => {
              const input = rec.inputTokens ?? 0
              const output = rec.outputTokens ?? 0
              const cacheWrite = rec.cacheCreationInputTokens ?? 0
              const cacheRead = rec.cacheReadInputTokens ?? 0
              return {
                id: String(rec.id),
                jobId: rec.jobId,
                model: rec.model,
                inputTokens: input,
                outputTokens: output,
                cacheReadTokens: cacheRead,
                cacheWriteTokens: cacheWrite,
                costUsd: calcCost(rec.model, input, output, cacheWrite, cacheRead),
                calledAt: rec.createdAt,
              }
            }),
            total: raw.length,
          }
        })
        .catch(() => ({ items: [], total: 0 })),
  })

  const dailyList = Array.isArray(daily) ? daily : []
  const recordList = Array.isArray(records?.items) ? records.items : []

  const tokenChartData = {
    labels: dailyList.map((d) => d.date),
    datasets: [
      {
        label: 'Input Tokens',
        data: dailyList.map((d) => d.inputTokens),
        backgroundColor: 'rgba(0,180,255,0.7)',
      },
      {
        label: 'Output Tokens',
        data: dailyList.map((d) => d.outputTokens),
        backgroundColor: 'rgba(255,133,206,0.7)',
      },
    ],
  }

  const costChartData = {
    labels: dailyList.map((d) => d.date),
    datasets: [
      {
        label: 'Cost (USD)',
        data: dailyList.map((d) => d.costUsd),
        backgroundColor: 'rgba(22,219,147,0.7)',
      },
    ],
  }

  return (
    <main>
      <PageHeader title="AI Stats" subtitle="Track AI API usage and costs." />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          ['Total Calls', summary?.totalCalls ?? '—'],
          ['Total Cost', summary?.totalCostUsd != null ? `$${summary.totalCostUsd.toFixed(2)}` : '—'],
          ['Avg Cost / Job', summary?.avgCostPerJob != null ? `$${summary.avgCostPerJob.toFixed(3)}` : '—'],
          ['Input Tokens', summary?.totalInputTokens != null ? summary.totalInputTokens.toLocaleString() : '—'],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-4 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]"
          >
            <p className="text-xs text-[var(--color-fonts-font-color-support)] mb-2 uppercase tracking-wide">
              {label}
            </p>
            <p className="text-xl font-bold text-[var(--color-fonts-font-color-headings)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      {dailyList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
            <h3 className="text-sm font-semibold mb-4 text-[var(--color-fonts-font-color-headings)]">Daily Token Usage</h3>
            <div style={{ height: 220 }}>
              <Bar data={tokenChartData} options={BAR_OPTIONS} />
            </div>
          </div>

          <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
            <h3 className="text-sm font-semibold mb-4 text-[var(--color-fonts-font-color-headings)]">Daily Cost (USD)</h3>
            <div style={{ height: 220 }}>
              <Bar data={costChartData} options={BAR_OPTIONS} />
            </div>
          </div>
        </div>
      )}

      {/* Records table */}
      <TableCard
        title="Recent Calls"
        subtitle={`${recordList.length} record${recordList.length !== 1 ? 's' : ''}`}
      >
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background)]">
              {([
                { label: 'Job ID',    tip: 'Agent job that triggered this AI call' },
                { label: 'Model',     tip: 'AI model used for this call' },
                { label: 'Input',     tip: 'Number of input tokens consumed' },
                { label: 'Output',    tip: 'Number of output tokens generated' },
                { label: 'Cost',      tip: 'Estimated cost in USD' },
                { label: 'Called At', tip: 'When the AI call was made' },
              ] as const).map(({ label, tip }) => (
                <th
                  key={label}
                  className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]"
                >
                  <Tooltip text={tip} position="bottom">{label}</Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recordList.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-[var(--color-fonts-font-color-support)]"
                >
                  No AI call records found.
                </td>
              </tr>
            ) : (
              recordList.map((rec) => (
                <tr
                  key={rec.id}
                  className="border-b border-[var(--color-tables-table-cell-stroke)] hover:bg-[var(--color-tables-table-hover)] transition-colors"
                >
                  <td className="px-4 py-1.5 font-mono text-[var(--color-fonts-font-color-support)]">
                    {rec.jobId?.slice(0, 8) ?? '—'}…
                  </td>
                  <td className="px-4 py-1.5">{rec.model}</td>
                  <td className="px-4 py-1.5">{rec.inputTokens.toLocaleString()}</td>
                  <td className="px-4 py-1.5">{rec.outputTokens.toLocaleString()}</td>
                  <td className="px-4 py-1.5">${rec.costUsd.toFixed(4)}</td>
                  <td className="px-4 py-1.5 text-[var(--color-fonts-font-color-support)]">
                    {new Date(rec.calledAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>
    </main>
  )
}
