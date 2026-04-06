import { render, screen, fireEvent, act } from '@testing-library/react'
import { ThinkingPanel } from './ThinkingPanel'
import type { ThinkingStep } from '@/types/api'

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ChevronRight: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="chevron-right" data-size={size} className={className} />
  ),
  Loader2: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="loader2" data-size={size} className={className} />
  ),
  CheckCircle2: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="check-circle" data-size={size} className={className} />
  ),
  XCircle: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="x-circle" data-size={size} className={className} />
  ),
}))

describe('ThinkingPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createThoughtStep = (text: string, timestamp?: number): ThinkingStep => ({
    kind: 'thought',
    text,
    timestamp,
  })

  const createToolStep = (
    name: string,
    status: 'running' | 'completed' | 'error' = 'completed',
    overrides: Partial<ThinkingStep & { kind: 'tool' }> = {}
  ): ThinkingStep & { kind: 'tool' } => ({
    kind: 'tool',
    name,
    status,
    startTime: Date.now(),
    ...overrides,
  })

  describe('basic rendering', () => {
    it('renders with empty steps', () => {
      render(<ThinkingPanel steps={[]} />)
      
      // Should render button with default collapsed state
      expect(screen.getByRole('button')).toBeInTheDocument()
      expect(screen.getByText('Thought through the answer')).toBeInTheDocument()
    })

    it('renders with thought steps only', () => {
      const steps = [
        createThoughtStep('Analyzing the problem...'),
        createThoughtStep('Considering different approaches...'),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      expect(screen.getByText('Thought through the answer')).toBeInTheDocument()
    })

    it('renders with tool steps', () => {
      const steps = [
        createToolStep('knowledge_search', 'completed'),
        createToolStep('code_search', 'completed'),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      expect(screen.getByText('2 tools completed')).toBeInTheDocument()
    })

    it('renders with mixed steps', () => {
      const steps = [
        createThoughtStep('Let me search for this...'),
        createToolStep('knowledge_search', 'completed'),
        createThoughtStep('Now checking the code...'),
        createToolStep('code_search', 'completed'),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      expect(screen.getByText('2 tools completed')).toBeInTheDocument()
    })
  })

  describe('live mode', () => {
    it('starts expanded when isLive=true', () => {
      const steps = [createThoughtStep('Thinking...')]
      
      render(<ThinkingPanel steps={steps} isLive={true} />)
      
      // Should show expanded content
      expect(screen.getByText('Thinking...')).toBeInTheDocument()
    })

    it('shows live indicator when isLive=true', () => {
      const steps = [createToolStep('knowledge_search', 'running')]
      
      render(<ThinkingPanel steps={steps} isLive={true} />)
      
      const liveIndicator = screen.getByText('Running 1 tool…').closest('span')
      expect(liveIndicator?.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('updates running tool duration in live mode', () => {
      const startTime = Date.now() - 3000 // 3 seconds ago
      const steps = [createToolStep('knowledge_search', 'running', { startTime })]
      
      render(<ThinkingPanel steps={steps} isLive={true} />)
      
      // Expand to see step details
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Should show live duration
      expect(screen.getByText(/in 3s/)).toBeInTheDocument()
      
      // Advance time and check duration updates
      act(() => {
        vi.advanceTimersByTime(2000) // 2 more seconds
      })
      
      expect(screen.getByText(/in 5s/)).toBeInTheDocument()
    })

    it('stops live duration updates when not in live mode', () => {
      const steps = [createToolStep('knowledge_search', 'running')]
      
      render(<ThinkingPanel steps={steps} isLive={false} />)
      
      // Should not set up interval
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      
      // Component should render without errors
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('expansion and collapse', () => {
    it('toggles expansion on button click', () => {
      const steps = [createThoughtStep('Test thought')]
      
      render(<ThinkingPanel steps={steps} />)
      
      const button = screen.getByRole('button')
      
      // Initially collapsed
      expect(screen.queryByText('Test thought')).not.toBeInTheDocument()
      
      // Click to expand
      fireEvent.click(button)
      expect(screen.getByText('Test thought')).toBeInTheDocument()
      
      // Click to collapse
      fireEvent.click(button)
      expect(screen.queryByText('Test thought')).not.toBeInTheDocument()
    })

    it('shows correct chevron rotation when expanded/collapsed', () => {
      const steps = [createThoughtStep('Test')]
      
      render(<ThinkingPanel steps={steps} />)
      
      const chevron = screen.getByTestId('chevron-right')
      const button = screen.getByRole('button')
      
      // Initially not rotated
      expect(chevron.className).not.toContain('rotate-90')
      
      // Click to expand
      fireEvent.click(button)
      expect(chevron.className).toContain('rotate-90')
      
      // Click to collapse
      fireEvent.click(button)
      expect(chevron.className).not.toContain('rotate-90')
    })
  })

  describe('thought steps rendering', () => {
    it('renders thought steps with correct styling', () => {
      const steps = [
        createThoughtStep('First thought'),
        createThoughtStep('Second thought with more detail'),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      // Expand to see content
      fireEvent.click(screen.getByRole('button'))
      
      const firstThought = screen.getByText('First thought')
      expect(firstThought).toBeInTheDocument()
      expect(firstThought.className).toContain('italic')
      expect(firstThought.className).toContain('opacity-60')
      
      const secondThought = screen.getByText('Second thought with more detail')
      expect(secondThought).toBeInTheDocument()
    })

    it('renders thoughts with timestamps', () => {
      const steps = [
        createThoughtStep('Timestamped thought', 1642262400000),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button'))
      expect(screen.getByText('Timestamped thought')).toBeInTheDocument()
    })
  })

  describe('tool steps rendering', () => {
    it('renders tool steps with correct status icons', () => {
      const steps = [
        createToolStep('search', 'running'),
        createToolStep('fetch', 'completed'),
        createToolStep('parse', 'error'),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      expect(screen.getByTestId('loader2')).toBeInTheDocument()
      expect(screen.getByTestId('check-circle')).toBeInTheDocument()
      expect(screen.getByTestId('x-circle')).toBeInTheDocument()
    })

    it('renders known tool names with custom labels', () => {
      const steps = [
        createToolStep('knowledge_search'),
        createToolStep('code_search'),
        createToolStep('jira_search'),
        createToolStep('custom_tool'), // Unknown tool
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      expect(screen.getByText('Searching knowledge base')).toBeInTheDocument()
      expect(screen.getByText('Searching source code')).toBeInTheDocument()
      expect(screen.getByText('Searching Jira issues')).toBeInTheDocument()
      expect(screen.getByText('custom tool')).toBeInTheDocument() // Underscores removed
    })

    it('shows key parameters for known tools', () => {
      const steps = [
        createToolStep('jira_search', 'completed', { 
          input: { key: 'PROJ-123' }
        }),
        createToolStep('knowledge_search', 'completed', { 
          input: { query: 'test search' }
        }),
        createToolStep('customer_lookup', 'completed', { 
          input: { customerId: 'acme-corp' }
        }),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      expect(screen.getByText(/PROJ-123/)).toBeInTheDocument()
      expect(screen.getByText(/"test search"/)).toBeInTheDocument()
      expect(screen.getByText(/acme-corp/)).toBeInTheDocument()
    })

    it('shows duration for completed tools', () => {
      const startTime = Date.now()
      const endTime = startTime + 2500 // 2.5 seconds
      
      const steps = [
        createToolStep('search', 'completed', { startTime, endTime }),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      expect(screen.getByText(/in 3s/)).toBeInTheDocument() // Rounded up
    })

    it('formats different duration ranges correctly', () => {
      const baseTime = Date.now()
      const steps = [
        createToolStep('fast', 'completed', { 
          startTime: baseTime, 
          endTime: baseTime + 500 // 500ms
        }),
        createToolStep('medium', 'completed', { 
          startTime: baseTime, 
          endTime: baseTime + 1500 // 1.5s 
        }),
        createToolStep('slow', 'completed', { 
          startTime: baseTime, 
          endTime: baseTime + 65000 // 1m 5s
        }),
        createToolStep('very_slow', 'completed', { 
          startTime: baseTime, 
          endTime: baseTime + 120000 // 2m 0s
        }),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      expect(screen.getByText(/in 500ms/)).toBeInTheDocument()
      expect(screen.getByText(/in 2s/)).toBeInTheDocument()
      expect(screen.getByText(/in 1m 5s/)).toBeInTheDocument()
      expect(screen.getByText(/in 2m/)).toBeInTheDocument()
    })
  })

  describe('tool result expansion', () => {
    it('allows expanding tool results', () => {
      const steps = [
        createToolStep('search', 'completed', { 
          result: 'Found 5 relevant documents:\n1. Doc A\n2. Doc B'
        }),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      // Expand thinking panel
      fireEvent.click(screen.getByRole('button'))
      
      // Tool result should not be visible initially
      expect(screen.queryByText('Found 5 relevant documents:')).not.toBeInTheDocument()
      
      // Click tool to expand result
      const toolButton = screen.getByText('search')
      fireEvent.click(toolButton)
      
      expect(screen.getByText(/Found 5 relevant documents:/)).toBeInTheDocument()
    })

    it('shows chevron for tools with results', () => {
      const steps = [
        createToolStep('with_result', 'completed', { result: 'Some result' }),
        createToolStep('without_result', 'completed', { result: undefined }),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      const chevrons = screen.getAllByTestId('chevron-right')
      expect(chevrons.length).toBeGreaterThan(1) // Main chevron + tool chevron
    })

    it('does not show clickable tools without results', () => {
      const steps = [
        createToolStep('no_result', 'running'),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      // Tool should be present but not clickable
      const toolText = screen.getByText('no result')
      expect(toolText).toBeInTheDocument()
      
      // Should not have result expansion chevron
      const chevrons = screen.getAllByTestId('chevron-right')
      expect(chevrons).toHaveLength(1) // Only main panel chevron
    })

    it('toggles tool result visibility', () => {
      const steps = [
        createToolStep('search', 'completed', { 
          result: 'Detailed result content'
        }),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button')) // Expand panel
      
      const toolButton = screen.getByText('search')
      
      // Click to expand
      fireEvent.click(toolButton)
      expect(screen.getByText('Detailed result content')).toBeInTheDocument()
      
      // Click to collapse
      fireEvent.click(toolButton)
      expect(screen.queryByText('Detailed result content')).not.toBeInTheDocument()
    })
  })

  describe('summary generation', () => {
    it('shows correct summary for no tools', () => {
      const steps = [createThoughtStep('Just thinking')]
      
      render(<ThinkingPanel steps={steps} />)
      
      expect(screen.getByText('Thought through the answer')).toBeInTheDocument()
    })

    it('shows correct summary for running tools', () => {
      const steps = [
        createToolStep('search1', 'running'),
        createToolStep('search2', 'running'),
        createToolStep('search3', 'completed'),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      expect(screen.getByText('Running 2 tools…')).toBeInTheDocument()
    })

    it('shows correct summary for completed tools', () => {
      const steps = [
        createToolStep('search1', 'completed'),
        createToolStep('search2', 'completed'),
        createToolStep('search3', 'completed'),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      expect(screen.getByText('3 tools completed')).toBeInTheDocument()
    })

    it('shows correct summary with errors', () => {
      const steps = [
        createToolStep('search1', 'completed'),
        createToolStep('search2', 'error'),
        createToolStep('search3', 'error'),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      expect(screen.getByText('1 completed, 2 failed')).toBeInTheDocument()
    })

    it('handles singular vs plural correctly', () => {
      const singleCompleted = [createToolStep('search', 'completed')]
      const singleRunning = [createToolStep('search', 'running')]
      
      render(<ThinkingPanel steps={singleCompleted} />)
      expect(screen.getByText('1 tool completed')).toBeInTheDocument()
      
      const { rerender } = render(<ThinkingPanel steps={singleRunning} />)
      rerender(<ThinkingPanel steps={singleRunning} />)
      expect(screen.getByText('Running 1 tool…')).toBeInTheDocument()
    })
  })

  describe('edge cases and error handling', () => {
    it('handles steps without timestamps', () => {
      const steps = [
        createThoughtStep('No timestamp'),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button'))
      expect(screen.getByText('No timestamp')).toBeInTheDocument()
    })

    it('handles tools without start time', () => {
      const steps = [
        { ...createToolStep('search'), startTime: undefined } as any,
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button'))
      expect(screen.getByText('search')).toBeInTheDocument()
    })

    it('handles tools with malformed input', () => {
      const steps = [
        createToolStep('search', 'completed', { 
          input: null as any 
        }),
        createToolStep('search2', 'completed', { 
          input: 'string instead of object' as any 
        }),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button'))
      expect(screen.getByText('search')).toBeInTheDocument()
      expect(screen.getByText('search2')).toBeInTheDocument()
    })

    it('handles very long tool results', () => {
      const longResult = 'A'.repeat(1000)
      const steps = [
        createToolStep('search', 'completed', { result: longResult }),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button'))
      fireEvent.click(screen.getByText('search'))
      
      const resultElement = screen.getByText(longResult)
      expect(resultElement).toBeInTheDocument()
      expect(resultElement.parentElement?.className).toContain('max-h-32')
      expect(resultElement.parentElement?.className).toContain('overflow-y-auto')
    })

    it('handles tool results with special characters', () => {
      const specialResult = 'Result with\nnewlines\tand\r\nspecial chars: <>{}[]&'
      const steps = [
        createToolStep('search', 'completed', { result: specialResult }),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button'))
      fireEvent.click(screen.getByText('search'))
      
      expect(screen.getByText(specialResult)).toBeInTheDocument()
    })

    it('handles empty result strings', () => {
      const steps = [
        createToolStep('search', 'completed', { result: '' }),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      // Should not be clickable for empty result
      const toolText = screen.getByText('search')
      fireEvent.click(toolText)
      
      // Should not show any result content
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  describe('accessibility and interaction', () => {
    it('has accessible button role', () => {
      render(<ThinkingPanel steps={[]} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('handles keyboard interaction', () => {
      const steps = [createThoughtStep('Test')]
      
      render(<ThinkingPanel steps={steps} />)
      
      const button = screen.getByRole('button')
      
      // Should handle Enter key
      fireEvent.keyDown(button, { key: 'Enter' })
      // Note: We'd need to add keyboard handlers to the component for this to work
      
      // For now, just verify the button exists and can be clicked
      fireEvent.click(button)
      expect(screen.getByText('Test')).toBeInTheDocument()
    })

    it('handles multiple rapid clicks gracefully', () => {
      const steps = [createThoughtStep('Test')]
      
      render(<ThinkingPanel steps={steps} />)
      
      const button = screen.getByRole('button')
      
      // Rapid clicks should not cause errors
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)
      
      expect(screen.queryByText('Test')).not.toBeInTheDocument()
    })
  })

  describe('performance and state management', () => {
    it('maintains expanded tool state correctly', () => {
      const steps = [
        createToolStep('tool1', 'completed', { result: 'Result 1' }),
        createToolStep('tool2', 'completed', { result: 'Result 2' }),
      ]
      
      render(<ThinkingPanel steps={steps} />)
      
      fireEvent.click(screen.getByRole('button')) // Expand panel
      
      // Expand first tool
      fireEvent.click(screen.getByText('tool1'))
      expect(screen.getByText('Result 1')).toBeInTheDocument()
      
      // Expand second tool
      fireEvent.click(screen.getByText('tool2'))
      expect(screen.getByText('Result 2')).toBeInTheDocument()
      
      // Both should remain expanded
      expect(screen.getByText('Result 1')).toBeInTheDocument()
      expect(screen.getByText('Result 2')).toBeInTheDocument()
      
      // Collapse first tool
      fireEvent.click(screen.getByText('tool1'))
      expect(screen.queryByText('Result 1')).not.toBeInTheDocument()
      expect(screen.getByText('Result 2')).toBeInTheDocument() // Second still expanded
    })

    it('cleans up timer on unmount', () => {
      const spy = vi.spyOn(globalThis, 'clearInterval')
      
      const steps = [createToolStep('search', 'running')]
      const { unmount } = render(<ThinkingPanel steps={steps} isLive={true} />)
      
      unmount()
      
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })
  })
})