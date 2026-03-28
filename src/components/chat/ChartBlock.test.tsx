import { render, screen, fireEvent } from '@testing-library/react'
import { ChartBlock } from './ChartBlock'

// Mock lucide-react
vi.mock('lucide-react', () => ({
  AlertTriangle: ({ size }: { size?: number }) => (
    <div data-testid="alert-triangle" data-size={size} />
  ),
}))

// Mock Chart.js and react-chartjs-2
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: vi.fn(),
  LinearScale: vi.fn(),
  LogarithmicScale: vi.fn(),
  RadialLinearScale: vi.fn(),
  BarElement: vi.fn(),
  LineElement: vi.fn(),
  PointElement: vi.fn(),
  ArcElement: vi.fn(),
  Title: vi.fn(),
  Tooltip: vi.fn(),
  Legend: vi.fn(),
  Filler: vi.fn(),
}))

vi.mock('react-chartjs-2', () => ({
  Bar: ({ data, options }: any) => (
    <div data-testid="bar-chart" data-type="bar" data-data={JSON.stringify(data)} data-options={JSON.stringify(options)} />
  ),
  Line: ({ data, options }: any) => (
    <div data-testid="line-chart" data-type="line" data-data={JSON.stringify(data)} data-options={JSON.stringify(options)} />
  ),
  Pie: ({ data, options }: any) => (
    <div data-testid="pie-chart" data-type="pie" data-data={JSON.stringify(data)} data-options={JSON.stringify(options)} />
  ),
  Doughnut: ({ data, options }: any) => (
    <div data-testid="doughnut-chart" data-type="doughnut" data-data={JSON.stringify(data)} data-options={JSON.stringify(options)} />
  ),
  Radar: ({ data, options }: any) => (
    <div data-testid="radar-chart" data-type="radar" data-data={JSON.stringify(data)} data-options={JSON.stringify(options)} />
  ),
  PolarArea: ({ data, options }: any) => (
    <div data-testid="polar-area-chart" data-type="polararea" data-data={JSON.stringify(data)} data-options={JSON.stringify(options)} />
  ),
}))

// Mock syntax highlighter
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children, language, style }: any) => (
    <pre data-testid="syntax-highlighter" data-language={language}>
      {children}
    </pre>
  ),
}))

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: 'mock-style',
}))

describe('ChartBlock', () => {
  const validBarChart = `{
    "type": "bar",
    "data": {
      "labels": ["A", "B", "C"],
      "datasets": [{
        "label": "Test Data",
        "data": [1, 2, 3]
      }]
    }
  }`

  const validLineChart = `{
    "type": "line",
    "data": {
      "labels": ["Jan", "Feb", "Mar"],
      "datasets": [{
        "label": "Sales",
        "data": [10, 20, 15]
      }]
    },
    "options": {
      "responsive": true
    }
  }`

  const jsObjectChart = `{
    type: 'pie',
    data: {
      labels: ['Red', 'Blue', 'Yellow'],
      datasets: [{
        data: [300, 50, 100],
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
      }]
    }
  }`

  describe('basic rendering', () => {
    it('renders chart container with header', () => {
      render(<ChartBlock code={validBarChart} />)

      expect(screen.getByText('chart')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /chart/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /source/i })).toBeInTheDocument()
    })

    it('starts with chart view selected', () => {
      render(<ChartBlock code={validBarChart} />)

      const chartButton = screen.getByRole('button', { name: /chart/i })
      const sourceButton = screen.getByRole('button', { name: /source/i })

      expect(chartButton.className).toContain('bg-white/15')
      expect(chartButton.className).toContain('text-white')
      expect(sourceButton.className).not.toContain('bg-white/15')
    })

    it('applies correct styling to container', () => {
      const { container } = render(<ChartBlock code={validBarChart} />)

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('rounded-[var(--border-radius-card)]')
      expect(wrapper.className).toContain('border')
      expect(wrapper.className).toContain('border-[var(--color-cards-card-stroke)]')
    })
  })

  describe('chart parsing and rendering', () => {
    it('renders valid JSON bar chart', () => {
      render(<ChartBlock code={validBarChart} />)

      const chart = screen.getByTestId('bar-chart')
      expect(chart).toBeInTheDocument()
      expect(chart).toHaveAttribute('data-type', 'bar')

      const data = JSON.parse(chart.getAttribute('data-data') || '{}')
      expect(data.labels).toEqual(['A', 'B', 'C'])
      expect(data.datasets[0].data).toEqual([1, 2, 3])
    })

    it('renders line chart with options', () => {
      render(<ChartBlock code={validLineChart} />)

      const chart = screen.getByTestId('line-chart')
      expect(chart).toBeInTheDocument()

      const options = JSON.parse(chart.getAttribute('data-options') || '{}')
      expect(options.responsive).toBe(true)
    })

    it('handles JavaScript object literal syntax', () => {
      render(<ChartBlock code={jsObjectChart} />)

      const chart = screen.getByTestId('pie-chart')
      expect(chart).toBeInTheDocument()
      expect(chart).toHaveAttribute('data-type', 'pie')
    })

    it('renders all supported chart types', () => {
      const chartTypes = [
        { type: 'bar', testId: 'bar-chart' },
        { type: 'line', testId: 'line-chart' },
        { type: 'pie', testId: 'pie-chart' },
        { type: 'doughnut', testId: 'doughnut-chart' },
        { type: 'radar', testId: 'radar-chart' },
        { type: 'polararea', testId: 'polar-area-chart' },
      ]

      chartTypes.forEach(({ type, testId }) => {
        const code = `{
          "type": "${type}",
          "data": {
            "labels": ["A", "B"],
            "datasets": [{"data": [1, 2]}]
          }
        }`

        const { unmount } = render(<ChartBlock code={code} />)
        expect(screen.getByTestId(testId)).toBeInTheDocument()
        unmount()
      })
    })

    it('handles case-insensitive chart types', () => {
      const code = `{
        "type": "BAR",
        "data": {
          "labels": ["A", "B"],
          "datasets": [{"data": [1, 2]}]
        }
      }`

      render(<ChartBlock code={code} />)
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('renders default options when not provided', () => {
      const code = `{
        "type": "bar",
        "data": {
          "labels": ["A", "B"],
          "datasets": [{"data": [1, 2]}]
        }
      }`

      render(<ChartBlock code={code} />)

      const chart = screen.getByTestId('bar-chart')
      const options = JSON.parse(chart.getAttribute('data-options') || '{}')
      expect(options).toEqual({})
    })
  })

  describe('error handling', () => {
    it('shows error for invalid JSON', () => {
      const invalidCode = '{ invalid json syntax'
      render(<ChartBlock code={invalidCode} />)

      expect(screen.getByText('Could not parse chart configuration.')).toBeInTheDocument()
      expect(screen.getByTestId('alert-triangle')).toBeInTheDocument()
    })

    it('shows error for invalid JavaScript object', () => {
      const invalidCode = '{ type: "bar", data: [function() {} } }'
      render(<ChartBlock code={invalidCode} />)

      expect(screen.getByText('Could not parse chart configuration.')).toBeInTheDocument()
    })

    it('shows error for unknown chart type', () => {
      const unknownTypeCode = `{
        "type": "unknown",
        "data": {
          "labels": ["A", "B"],
          "datasets": [{"data": [1, 2]}]
        }
      }`

      render(<ChartBlock code={unknownTypeCode} />)

      expect(screen.getByText('Unknown chart type: unknown')).toBeInTheDocument()
      expect(screen.getByTestId('alert-triangle')).toBeInTheDocument()
    })

    it('handles missing type property', () => {
      const noTypeCode = `{
        "data": {
          "labels": ["A", "B"],
          "datasets": [{"data": [1, 2]}]
        }
      }`

      render(<ChartBlock code={noTypeCode} />)

      expect(screen.getByText(/Unknown chart type:/)).toBeInTheDocument()
    })

    it('handles null/undefined type', () => {
      const nullTypeCode = `{
        "type": null,
        "data": {
          "labels": ["A", "B"],
          "datasets": [{"data": [1, 2]}]
        }
      }`

      render(<ChartBlock code={nullTypeCode} />)

      expect(screen.getByText(/Unknown chart type:/)).toBeInTheDocument()
    })

    it('handles empty code string', () => {
      render(<ChartBlock code="" />)

      expect(screen.getByText('Could not parse chart configuration.')).toBeInTheDocument()
    })

    it('handles malformed JavaScript object literals', () => {
      const malformedCode = `{
        type: 'bar',
        data: {
          labels: ['A', 'B'
        }
      }`

      render(<ChartBlock code={malformedCode} />)

      expect(screen.getByText('Could not parse chart configuration.')).toBeInTheDocument()
    })
  })

  describe('view switching', () => {
    it('switches to source view when source button is clicked', () => {
      render(<ChartBlock code={validBarChart} />)

      const sourceButton = screen.getByRole('button', { name: /source/i })
      fireEvent.click(sourceButton)

      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument()
      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument()

      // Check button states
      const chartButton = screen.getByRole('button', { name: /chart/i })
      expect(sourceButton.className).toContain('bg-white/15')
      expect(chartButton.className).not.toContain('bg-white/15')
    })

    it('switches back to chart view when chart button is clicked', () => {
      render(<ChartBlock code={validBarChart} />)

      // Switch to source
      fireEvent.click(screen.getByRole('button', { name: /source/i }))
      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument()

      // Switch back to chart
      fireEvent.click(screen.getByRole('button', { name: /chart/i }))
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
      expect(screen.queryByTestId('syntax-highlighter')).not.toBeInTheDocument()
    })

    it('shows syntax highlighter with correct language and code', () => {
      render(<ChartBlock code={validBarChart} />)

      fireEvent.click(screen.getByRole('button', { name: /source/i }))

      const highlighter = screen.getByTestId('syntax-highlighter')
      expect(highlighter).toBeInTheDocument()
      expect(highlighter).toHaveAttribute('data-language', 'javascript')
      expect(highlighter).toHaveTextContent(validBarChart)
    })

    it('preserves view state across re-renders', () => {
      const { rerender } = render(<ChartBlock code={validBarChart} />)

      // Switch to source view
      fireEvent.click(screen.getByRole('button', { name: /source/i }))
      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument()

      // Re-render with same props
      rerender(<ChartBlock code={validBarChart} />)
      expect(screen.getByTestId('syntax-highlighter')).toBeInTheDocument()
    })
  })

  describe('chart container styling', () => {
    it('applies correct styling to chart container', () => {
      render(<ChartBlock code={validBarChart} />)

      const chartContainer = screen.getByTestId('bar-chart').parentElement
      expect(chartContainer?.style.height).toBe('340px')
      expect(chartContainer?.style.width).toBe('100%')
      expect(chartContainer?.style.resize).toBe('both')
      expect(chartContainer?.style.overflow).toBe('hidden')
      expect(chartContainer?.style.minWidth).toBe('240px')
      expect(chartContainer?.style.minHeight).toBe('180px')
    })

    it('applies correct background to chart area', () => {
      const { container } = render(<ChartBlock code={validBarChart} />)

      const chartArea = container.querySelector('.bg-\\[var\\(--color-cards-card-background\\)\\]')
      expect(chartArea).toBeInTheDocument()
    })
  })

  describe('header styling', () => {
    it('applies correct styling to header', () => {
      const { container } = render(<ChartBlock code={validBarChart} />)

      const header = container.querySelector('.bg-\\[#282c34\\]')
      expect(header).toBeInTheDocument()
      expect(header?.className).toContain('border-b')
      expect(header?.className).toContain('border-white/10')
    })

    it('applies correct button hover states', () => {
      render(<ChartBlock code={validBarChart} />)

      const sourceButton = screen.getByRole('button', { name: /source/i })
      expect(sourceButton.className).toContain('hover:text-white')
      expect(sourceButton.className).toContain('hover:bg-white/10')
    })
  })

  describe('complex chart configurations', () => {
    it('handles complex chart data with multiple datasets', () => {
      const complexChart = `{
        "type": "line",
        "data": {
          "labels": ["Jan", "Feb", "Mar", "Apr", "May"],
          "datasets": [
            {
              "label": "Sales",
              "data": [10, 20, 15, 25, 30],
              "borderColor": "rgb(255, 99, 132)",
              "backgroundColor": "rgba(255, 99, 132, 0.2)"
            },
            {
              "label": "Expenses", 
              "data": [5, 15, 10, 20, 25],
              "borderColor": "rgb(54, 162, 235)",
              "backgroundColor": "rgba(54, 162, 235, 0.2)"
            }
          ]
        },
        "options": {
          "responsive": true,
          "plugins": {
            "legend": {
              "position": "top"
            },
            "title": {
              "display": true,
              "text": "Sales vs Expenses"
            }
          }
        }
      }`

      render(<ChartBlock code={complexChart} />)

      const chart = screen.getByTestId('line-chart')
      expect(chart).toBeInTheDocument()

      const data = JSON.parse(chart.getAttribute('data-data') || '{}')
      expect(data.datasets).toHaveLength(2)
      expect(data.datasets[0].label).toBe('Sales')
      expect(data.datasets[1].label).toBe('Expenses')

      const options = JSON.parse(chart.getAttribute('data-options') || '{}')
      expect(options.plugins.title.text).toBe('Sales vs Expenses')
    })

    it('handles charts with nested object configurations', () => {
      const nestedChart = `{
        "type": "radar",
        "data": {
          "labels": ["Speed", "Reliability", "Comfort", "Safety"],
          "datasets": [{
            "label": "Car A",
            "data": [4, 3, 5, 4],
            "fill": true,
            "backgroundColor": "rgba(255, 99, 132, 0.2)",
            "borderColor": "rgb(255, 99, 132)",
            "pointBackgroundColor": "rgb(255, 99, 132)"
          }]
        },
        "options": {
          "elements": {
            "line": {
              "borderWidth": 3
            }
          }
        }
      }`

      render(<ChartBlock code={nestedChart} />)

      const chart = screen.getByTestId('radar-chart')
      expect(chart).toBeInTheDocument()

      const options = JSON.parse(chart.getAttribute('data-options') || '{}')
      expect(options.elements.line.borderWidth).toBe(3)
    })
  })

  describe('edge cases', () => {
    it('handles whitespace in code', () => {
      const codeWithWhitespace = `
        {
          "type": "bar",
          "data": {
            "labels": ["A", "B"],
            "datasets": [{"data": [1, 2]}]
          }
        }
      `

      render(<ChartBlock code={codeWithWhitespace} />)
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('handles single quotes in JavaScript object literals', () => {
      const singleQuoteCode = `{
        type: 'doughnut',
        data: {
          labels: ['Red', 'Blue'],
          datasets: [{data: [50, 50]}]
        }
      }`

      render(<ChartBlock code={singleQuoteCode} />)
      expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument()
    })

    it('handles numeric property names', () => {
      const numericProps = `{
        "type": "pie",
        "data": {
          "labels": ["A", "B"],
          "datasets": [{
            "data": [1, 2],
            0: "should be ignored"
          }]
        }
      }`

      render(<ChartBlock code={numericProps} />)
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    })

    it('handles very large datasets', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => i)
      const largeLabels = Array.from({ length: 1000 }, (_, i) => `Label ${i}`)
      
      const largeChart = JSON.stringify({
        type: 'bar',
        data: {
          labels: largeLabels,
          datasets: [{
            label: 'Large Dataset',
            data: largeData
          }]
        }
      })

      render(<ChartBlock code={largeChart} />)
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('handles empty data arrays', () => {
      const emptyChart = `{
        "type": "line",
        "data": {
          "labels": [],
          "datasets": [{
            "label": "Empty",
            "data": []
          }]
        }
      }`

      render(<ChartBlock code={emptyChart} />)
      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has accessible button roles', () => {
      render(<ChartBlock code={validBarChart} />)

      expect(screen.getByRole('button', { name: /chart/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /source/i })).toBeInTheDocument()
    })

    it('maintains focus when switching views', () => {
      render(<ChartBlock code={validBarChart} />)

      const sourceButton = screen.getByRole('button', { name: /source/i })
      sourceButton.focus()
      fireEvent.click(sourceButton)

      expect(document.activeElement).toBe(sourceButton)
    })
  })
})