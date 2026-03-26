import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  TimeScale,
  Tooltip,
  Legend,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { Bar } from 'react-chartjs-2'
import { Loader2, CalendarDays } from 'lucide-react'
import api from '@/lib/api'
import type { RoadmapSprintGroup } from '@/types/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, TimeScale, Tooltip, Legend)

// Palette for epics (grandparentKey or parentKey colour-coding)
const EPIC_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
]

interface Props {
  roadmapId: string
}

export function SprintGanttView({ roadmapId }: Props) {
  const { data, isLoading, isError } = useQuery<RoadmapSprintGroup[]>({
    queryKey: ['roadmap-sprints', roadmapId],
    queryFn: () => api.get(`/roadmap/${roadmapId}/sprints`).then((r) => r.data),
  })

  const groups = Array.isArray(data) ? data : []

  // Collect unique epic keys to assign colors
  const epicColors = useMemo(() => {
    const keys = new Set<string>()
    for (const g of groups) {
      for (const item of g.items) {
        const epicKey = item.grandparentKey ?? item.parentKey ?? item.issueKey
        keys.add(epicKey)
      }
    }
    const map: Record<string, string> = {}
    Array.from(keys).forEach((k, i) => {
      map[k] = EPIC_COLORS[i % EPIC_COLORS.length]
    })
    return map
  }, [groups])

  const chartData = useMemo(() => {
    const labels: string[] = []
    const bars: { data: [number, number][]; backgroundColor: string[]; label: string }[] = []

    // Build one dataset per item so each bar can have its own colour
    for (const group of groups) {
      for (const item of group.items) {
        const label = item.issueType === 'FEATURE'
          ? `${item.issueKey} (Feature)`
          : `  ${item.issueKey} (Story)`

        const start = item.sprintStart ? new Date(item.sprintStart).getTime() : new Date(group.sprintStart ?? '').getTime()
        const end   = item.sprintEnd   ? new Date(item.sprintEnd).getTime()   : new Date(group.sprintEnd   ?? '').getTime()

        const epicKey = item.grandparentKey ?? item.parentKey ?? item.issueKey
        const color = epicColors[epicKey] ?? '#6366f1'

        labels.push(label)
        bars.push({
          label: item.issueKey,
          data: [[start, end]],
          backgroundColor: [item.issueType === 'FEATURE' ? color : color + '99'],
        })
      }
    }

    return { labels, datasets: bars }
  }, [groups, epicColors])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-sm text-[var(--color-fonts-font-color-support)]">
        <Loader2 size={16} className="animate-spin" />
        Loading sprint view…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="py-8 text-center text-sm text-[var(--color-fonts-font-color-support)]">
        Failed to load sprint data.
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-[var(--color-fonts-font-color-support)]">
        <CalendarDays size={32} className="opacity-40" />
        <p className="text-sm">No sprint-assigned items found.</p>
        <p className="text-xs opacity-70">Sync from Jira and make sure features/stories are assigned to a sprint.</p>
      </div>
    )
  }

  return (
    <div className="rounded-[var(--border-radius-card)] border border-[var(--color-cards-card-stroke)] bg-[var(--color-cards-card-background)] overflow-hidden shadow-[0_1px_3px_var(--color-cards-card-drop-shadow)]">
      {/* Sprint legend */}
      <div className="flex flex-wrap gap-3 px-4 py-2.5 border-b border-[var(--color-tables-table-header-stroke)] bg-[var(--color-cards-card-background-hover)]">
        {groups.map((g) => (
          <div key={g.sprintName} className="flex items-center gap-1.5 text-xs text-[var(--color-fonts-font-color-support)]">
            <CalendarDays size={11} />
            <span className="font-medium">{g.sprintName}</span>
            {g.sprintStart && g.sprintEnd && (
              <span className="opacity-70">
                ({new Date(g.sprintStart).toLocaleDateString()} – {new Date(g.sprintEnd).toLocaleDateString()})
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Gantt chart */}
      <div className="px-4 py-4" style={{ height: `${Math.max(300, chartData.labels.length * 28 + 60)}px` }}>
        <Bar
          data={{
            labels: chartData.labels,
            datasets: chartData.datasets.map((d) => ({
              label: d.label,
              data: d.data,
              backgroundColor: d.backgroundColor,
              borderSkipped: false,
              borderRadius: 3,
              barThickness: 18,
            })),
          }}
          options={{
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                type: 'time',
                time: { unit: 'week', displayFormats: { week: 'MMM d' } },
                grid: { color: 'rgba(128,128,128,0.15)' },
                ticks: { font: { size: 10 } },
              },
              y: {
                ticks: { font: { size: 10 }, padding: 4 },
                grid: { display: false },
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  title: (items) => items[0]?.label ?? '',
                  label: (item) => {
                    const [s, e] = item.raw as [number, number]
                    return `${new Date(s).toLocaleDateString()} – ${new Date(e).toLocaleDateString()}`
                  },
                },
              },
            },
          }}
        />
      </div>
    </div>
  )
}
