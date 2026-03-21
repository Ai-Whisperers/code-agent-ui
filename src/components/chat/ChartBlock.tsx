import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  RadialLinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Bar, Line, Pie, Doughnut, Radar, PolarArea } from 'react-chartjs-2'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

// Register Chart.js plugins once at module level
ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  RadialLinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

type ChartConfig = {
  type: string
  data: never
  options?: never
}

function parseChartConfig(code: string): ChartConfig | null {
  // Try strict JSON first, then fall back to JS object literal evaluation
  try {
    return JSON.parse(code) as ChartConfig
  } catch {
    try {
      return new Function('return ' + code)() as ChartConfig
    } catch {
      return null
    }
  }
}

export function ChartBlock({ code }: { code: string }) {
  const [view, setView] = useState<'chart' | 'source'>('chart')

  const config = parseChartConfig(code)

  const renderChart = () => {
    if (!config) {
      return (
        <div className="flex items-center gap-2 text-[var(--color-fonts-font-color-support)] text-sm p-4">
          <AlertTriangle size={15} />
          Could not parse chart configuration.
        </div>
      )
    }

    const opts = (config.options ?? {}) as never
    const data = config.data

    switch (config.type?.toLowerCase()) {
      case 'bar':
        return <Bar data={data} options={opts} />
      case 'line':
        return <Line data={data} options={opts} />
      case 'pie':
        return <Pie data={data} options={opts} />
      case 'doughnut':
        return <Doughnut data={data} options={opts} />
      case 'radar':
        return <Radar data={data} options={opts} />
      case 'polararea':
        return <PolarArea data={data} options={opts} />
      default:
        return (
          <div className="flex items-center gap-2 text-[var(--color-fonts-font-color-support)] text-sm p-4">
            <AlertTriangle size={15} />
            Unknown chart type: {config.type}
          </div>
        )
    }
  }

  return (
    <div className="my-4 rounded-[var(--border-radius-card)] overflow-hidden border border-[var(--color-cards-card-stroke)]">
      {/* Header bar with toggle */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#282c34] border-b border-white/10">
        <span className="text-xs font-mono text-[#abb2bf] uppercase tracking-wider">chart</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView('chart')}
            className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
              view === 'chart'
                ? 'bg-white/15 text-white'
                : 'text-[#abb2bf] hover:text-white hover:bg-white/10'
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setView('source')}
            className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
              view === 'source'
                ? 'bg-white/15 text-white'
                : 'text-[#abb2bf] hover:text-white hover:bg-white/10'
            }`}
          >
            Source
          </button>
        </div>
      </div>

      {/* Body */}
      {view === 'chart' ? (
        <div className="bg-[var(--color-cards-card-background)] p-4">
          <div
            style={{
              height: '340px',
              width: '100%',
              resize: 'both',
              overflow: 'hidden',
              minWidth: '240px',
              minHeight: '180px',
            }}
          >
            {renderChart()}
          </div>
        </div>
      ) : (
        <SyntaxHighlighter
          language="javascript"
          style={oneDark}
          customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.8125rem' }}
        >
          {code}
        </SyntaxHighlighter>
      )}
    </div>
  )
}
