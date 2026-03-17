import { useQuery } from '@tanstack/react-query'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { PageHeader } from '@/components/layout/PageHeader'
import api from '@/lib/api'
import type { AiCallSummary, AiCallDailyStat, AiCallRecord } from '@/types/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const BAR_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' as const } },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
    x: { grid: { display: false } },
  },
}

export default function AiStatsPage() {
  const { data: summary } = useQuery<AiCallSummary>({
    queryKey: ['ai-calls-summary'],
    queryFn: () => api.get('/stats/ai-calls/summary').then((r) => r.data),
  })

  const { data: daily } = useQuery<AiCallDailyStat[]>({
    queryKey: ['ai-calls-daily'],
    queryFn: () => api.get('/stats/ai-calls/daily').then((r) => r.data).catch(() => []),
  })

  const { data: records } = useQuery<{ items: AiCallRecord[]; total: number }>({
    queryKey: ['ai-calls-records'],
    queryFn: () => api.get('/stats/ai-calls?page=0&size=20').then((r) => r.data).catch(() => ({ items: [], total: 0 })),
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
          ['Total Cost', summary ? `$${summary.totalCostUsd.toFixed(2)}` : '—'],
          ['Avg Cost / Job', summary ? `$${summary.avgCostPerJob.toFixed(3)}` : '—'],
          ['Input Tokens', summary ? summary.totalInputTokens.toLocaleString() : '—'],
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
            <h3 className="mb-4">Daily Token Usage</h3>
            <div style={{ height: 220 }}>
              <Bar data={tokenChartData} options={BAR_OPTIONS} />
            </div>
          </div>

          <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] p-5 shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
            <h3 className="mb-4">Daily Cost (USD)</h3>
            <div style={{ height: 220 }}>
              <Bar data={costChartData} options={BAR_OPTIONS} />
            </div>
          </div>
        </div>
      )}

      {/* Records table */}
      <div className="bg-[var(--color-cards-card-background)] border border-[var(--color-cards-card-stroke)] rounded-[var(--border-radius-card)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
        <div className="px-5 py-3 bg-[var(--color-cards-small-section-background)] border-b border-[var(--color-cards-card-stroke)]">
          <h3>Recent Calls</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-tables-table-header-stroke)]">
              {['Job ID', 'Model', 'Input', 'Output', 'Cost', 'Called At'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-fonts-font-color-support)]"
                >
                  {h}
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
              recordList.map((rec, i) => (
                <tr
                  key={rec.id}
                  className={`border-b border-[var(--color-tables-table-cell-stroke)] ${
                    i % 2 === 0 ? 'bg-[var(--color-tables-table-row-a)]' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-fonts-font-color-support)]">
                    {rec.jobId?.slice(0, 8) ?? '—'}…
                  </td>
                  <td className="px-4 py-3 text-xs">{rec.model}</td>
                  <td className="px-4 py-3">{rec.inputTokens.toLocaleString()}</td>
                  <td className="px-4 py-3">{rec.outputTokens.toLocaleString()}</td>
                  <td className="px-4 py-3">${rec.costUsd.toFixed(4)}</td>
                  <td className="px-4 py-3 text-[var(--color-fonts-font-color-support)]">
                    {new Date(rec.calledAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
