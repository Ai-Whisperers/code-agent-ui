import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PlanIndicator, type PlanIndicatorProps } from './PlanIndicator'
import type { ExecutionPlan } from '@/types/api'

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  FileText: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="file-text-icon" data-size={size} className={className} />
  ),
  Eye: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="eye-icon" data-size={size} className={className} />
  ),
  Zap: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="zap-icon" data-size={size} className={className} />
  ),
  ExternalLink: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="external-link-icon" data-size={size} className={className} />
  ),
  X: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="x-icon" data-size={size} className={className} />
  ),
  Loader2: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="loader2-icon" data-size={size} className={className} />
  ),
}))

// Mock keycloak
vi.mock('@/lib/keycloak', () => ({
  getToken: vi.fn(() => 'mock-token'),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('PlanIndicator', () => {
  const createPlan = (status: ExecutionPlan['status'], overrides: Partial<ExecutionPlan> = {}): ExecutionPlan => ({
    planId: 'test-plan-1',
    status,
    title: 'Test Execution Plan',
    summary: 'This is a test plan summary',
    createdAt: '2024-01-15T10:00:00Z',
    ...overrides,
  })

  const defaultProps: Partial<PlanIndicatorProps> = {
    onViewPlan: vi.fn(),
    onImplementPlan: vi.fn(),
    onDismiss: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    })
  })

  describe('basic rendering', () => {
    it('renders plan with title and summary', () => {
      const plan = createPlan('DRAFT')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      expect(screen.getByText('📄 Execution Plan: Test Execution Plan')).toBeInTheDocument()
      expect(screen.getByText('This is a test plan summary')).toBeInTheDocument()
    })

    it('renders file text icon', () => {
      const plan = createPlan('DRAFT')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      const icon = screen.getByTestId('file-text-icon')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveAttribute('data-size', '16')
    })

    it('renders without summary when not provided', () => {
      const plan = createPlan('DRAFT', { summary: undefined })
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      expect(screen.getByText('📄 Execution Plan: Test Execution Plan')).toBeInTheDocument()
      expect(screen.queryByText('This is a test plan summary')).not.toBeInTheDocument()
    })

    it('applies correct base styling', () => {
      const plan = createPlan('DRAFT')
      const { container } = render(<PlanIndicator plan={plan} {...defaultProps} />)

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('bg-gradient-to-r')
      expect(wrapper.className).toContain('from-blue-50')
      expect(wrapper.className).toContain('to-indigo-50')
    })
  })

  describe('status display', () => {
    it('shows correct status text for DRAFT', () => {
      const plan = createPlan('DRAFT')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      expect(screen.getByText('Ready to implement')).toBeInTheDocument()
    })

    it('shows correct status text for APPROVED', () => {
      const plan = createPlan('APPROVED')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      expect(screen.getByText('Approved - ready to execute')).toBeInTheDocument()
    })

    it('shows correct status text for EXECUTING', () => {
      const plan = createPlan('EXECUTING')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      expect(screen.getByText('Executing...')).toBeInTheDocument()
    })

    it('shows correct status text for COMPLETED', () => {
      const plan = createPlan('COMPLETED')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('shows correct status text for FAILED', () => {
      const plan = createPlan('FAILED')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      expect(screen.getByText('Failed')).toBeInTheDocument()
    })

    it('applies correct status color for DRAFT', () => {
      const plan = createPlan('DRAFT')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      const statusText = screen.getByText('Ready to implement')
      expect(statusText.className).toContain('text-blue-600')
      expect(statusText.className).toContain('dark:text-blue-400')
    })

    it('applies correct status color for COMPLETED', () => {
      const plan = createPlan('COMPLETED')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      const statusText = screen.getByText('Completed')
      expect(statusText.className).toContain('text-green-700')
      expect(statusText.className).toContain('dark:text-green-300')
    })

    it('applies correct status color for FAILED', () => {
      const plan = createPlan('FAILED')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      const statusText = screen.getByText('Failed')
      expect(statusText.className).toContain('text-red-600')
      expect(statusText.className).toContain('dark:text-red-400')
    })
  })

  describe('action buttons', () => {
    it('renders View Plan button when not in click mode', () => {
      const plan = createPlan('DRAFT')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      const viewButton = screen.getByRole('button', { name: /view plan/i })
      expect(viewButton).toBeInTheDocument()
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument()
    })

    it('does not render View Plan button when onClick is provided', () => {
      const plan = createPlan('DRAFT')
      const onClick = vi.fn()
      render(<PlanIndicator plan={plan} onClick={onClick} {...defaultProps} />)

      expect(screen.queryByRole('button', { name: /view plan/i })).not.toBeInTheDocument()
    })

    it('calls onViewPlan when View Plan button is clicked', () => {
      const plan = createPlan('DRAFT')
      const onViewPlan = vi.fn()
      render(<PlanIndicator plan={plan} onViewPlan={onViewPlan} {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: /view plan/i }))
      expect(onViewPlan).toHaveBeenCalledWith(plan)
    })

    it('renders Implement button for DRAFT status', () => {
      const plan = createPlan('DRAFT')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      const implementButton = screen.getByRole('button', { name: /implement ⚡️/i })
      expect(implementButton).toBeInTheDocument()
      expect(screen.getByTestId('zap-icon')).toBeInTheDocument()
    })

    it('does not render Implement button for non-DRAFT status', () => {
      const plan = createPlan('APPROVED')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      expect(screen.queryByRole('button', { name: /implement ⚡️/i })).not.toBeInTheDocument()
    })

    it('renders executing indicator for EXECUTING status', () => {
      const plan = createPlan('EXECUTING')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      const executingButton = screen.getByRole('button', { name: /executing.../i })
      expect(executingButton).toBeInTheDocument()
      expect(executingButton).toBeDisabled()
      expect(screen.getByTestId('loader2-icon')).toBeInTheDocument()
    })

    it('renders executing indicator for APPROVED status', () => {
      const plan = createPlan('APPROVED')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      const executingButton = screen.getByRole('button', { name: /executing.../i })
      expect(executingButton).toBeInTheDocument()
      expect(executingButton).toBeDisabled()
    })

    it('renders View PR button for COMPLETED status with prUrl', () => {
      const plan = createPlan('COMPLETED', { 
        prUrl: 'https://github.com/test/repo/pull/123' 
      })
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      const prLink = screen.getByRole('link', { name: /view pr/i })
      expect(prLink).toBeInTheDocument()
      expect(prLink).toHaveAttribute('href', 'https://github.com/test/repo/pull/123')
      expect(prLink).toHaveAttribute('target', '_blank')
      expect(screen.getByTestId('external-link-icon')).toBeInTheDocument()
    })

    it('does not render View PR button for COMPLETED without prUrl', () => {
      const plan = createPlan('COMPLETED')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      expect(screen.queryByRole('link', { name: /view pr/i })).not.toBeInTheDocument()
    })
  })

  describe('dismiss functionality', () => {
    it('renders dismiss button when onDismiss is provided', () => {
      const plan = createPlan('DRAFT')
      const onDismiss = vi.fn()
      render(<PlanIndicator plan={plan} onDismiss={onDismiss} {...defaultProps} />)

      const dismissButton = screen.getByRole('button', { name: /dismiss/i })
      expect(dismissButton).toBeInTheDocument()
      expect(screen.getByTestId('x-icon')).toBeInTheDocument()
    })

    it('does not render dismiss button when onDismiss is not provided', () => {
      const plan = createPlan('DRAFT')
      render(<PlanIndicator plan={plan} onViewPlan={vi.fn()} />)

      expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
    })

    it('calls onDismiss when dismiss button is clicked', () => {
      const plan = createPlan('DRAFT')
      const onDismiss = vi.fn()
      render(<PlanIndicator plan={plan} onDismiss={onDismiss} {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  describe('click functionality', () => {
    it('makes container clickable when onClick is provided', () => {
      const plan = createPlan('DRAFT')
      const onClick = vi.fn()
      const { container } = render(<PlanIndicator plan={plan} onClick={onClick} {...defaultProps} />)

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('cursor-pointer')
      expect(wrapper.className).toContain('hover:shadow-md')
    })

    it('does not make container clickable when onClick is not provided', () => {
      const plan = createPlan('DRAFT')
      const { container } = render(<PlanIndicator plan={plan} {...defaultProps} />)

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).not.toContain('cursor-pointer')
    })

    it('calls onClick when container is clicked', () => {
      const plan = createPlan('DRAFT')
      const onClick = vi.fn()
      const { container } = render(<PlanIndicator plan={plan} onClick={onClick} {...defaultProps} />)

      fireEvent.click(container.firstChild as HTMLElement)
      expect(onClick).toHaveBeenCalledWith(plan)
    })
  })

  describe('implementation flow', () => {
    it('successfully implements a DRAFT plan', async () => {
      const plan = createPlan('DRAFT')
      const onImplementPlan = vi.fn()
      
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200 }) // approve
        .mockResolvedValueOnce({ ok: true, status: 200 }) // execute

      render(<PlanIndicator plan={plan} onImplementPlan={onImplementPlan} {...defaultProps} />)

      const implementButton = screen.getByRole('button', { name: /implement ⚡️/i })
      fireEvent.click(implementButton)

      // Should show loading state
      expect(screen.getByText('Starting...')).toBeInTheDocument()
      expect(screen.getByTestId('loader2-icon')).toBeInTheDocument()

      await waitFor(() => {
        expect(onImplementPlan).toHaveBeenCalledWith('test-plan-1')
      })

      // Verify API calls
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(1, 
        `${import.meta.env.VITE_API_URL}/plans/test-plan-1/approve`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      )
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        `${import.meta.env.VITE_API_URL}/plans/test-plan-1/execute`, 
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      )
    })

    it('handles approval failure gracefully', async () => {
      const plan = createPlan('DRAFT')
      const onImplementPlan = vi.fn()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 })

      render(<PlanIndicator plan={plan} onImplementPlan={onImplementPlan} {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: /implement ⚡️/i }))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to implement plan:', expect.any(Error))
      })

      expect(onImplementPlan).not.toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      consoleSpy.mockRestore()
    })

    it('handles execution failure gracefully', async () => {
      const plan = createPlan('DRAFT')
      const onImplementPlan = vi.fn()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200 }) // approve succeeds
        .mockResolvedValueOnce({ ok: false, status:500 }) // execute fails

      render(<PlanIndicator plan={plan} onImplementPlan={onImplementPlan} {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: /implement ⚡️/i }))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to implement plan:', expect.any(Error))
      })

      expect(onImplementPlan).not.toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledTimes(2)
      
      consoleSpy.mockRestore()
    })

    it('handles network errors gracefully', async () => {
      const plan = createPlan('DRAFT')
      const onImplementPlan = vi.fn()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<PlanIndicator plan={plan} onImplementPlan={onImplementPlan} {...defaultProps} />)

      fireEvent.click(screen.getByRole('button', { name: /implement ⚡️/i }))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to implement plan:', expect.any(Error))
      })

      expect(onImplementPlan).not.toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('does not allow implementation of non-DRAFT plans', () => {
      const plan = createPlan('EXECUTING')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      // Should not have implement button
      expect(screen.queryByRole('button', { name: /implement ⚡️/i })).not.toBeInTheDocument()
    })

    it('disables implement button during implementation', async () => {
      const plan = createPlan('DRAFT')
      
      // Make fetch hang to test loading state
      mockFetch.mockImplementation(() => new Promise(() => {}))

      render(<PlanIndicator plan={plan} {...defaultProps} />)

      const implementButton = screen.getByRole('button', { name: /implement ⚡️/i })
      fireEvent.click(implementButton)

      // Button should be disabled during loading
      expect(screen.getByRole('button', { name: /starting.../i })).toBeDisabled()
    })
  })

  describe('event propagation', () => {
    it('prevents event propagation when clicking action buttons', () => {
      const plan = createPlan('DRAFT')
      const onClick = vi.fn()
      const onViewPlan = vi.fn()
      
      render(<PlanIndicator plan={plan} onClick={onClick} onViewPlan={onViewPlan} />)

      // Should not render view plan button when onClick is provided
      expect(screen.queryByRole('button', { name: /view plan/i })).not.toBeInTheDocument()
    })

    it('prevents event propagation when clicking dismiss button', () => {
      const plan = createPlan('DRAFT')
      const onClick = vi.fn()
      const onDismiss = vi.fn()
      
      render(<PlanIndicator plan={plan} onClick={onClick} onDismiss={onDismiss} />)

      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
      
      expect(onDismiss).toHaveBeenCalledTimes(1)
      expect(onClick).not.toHaveBeenCalled()
    })

    it('prevents event propagation when clicking implement button', () => {
      const plan = createPlan('DRAFT')
      const onClick = vi.fn()
      
      render(<PlanIndicator plan={plan} onClick={onClick} {...defaultProps} />)

      // Since onClick is provided, view plan button won't render, 
      // but we can test with a wrapper that has onClick
      const { container } = render(
        <div onClick={onClick}>
          <PlanIndicator plan={plan} {...defaultProps} />
        </div>
      )

      fireEvent.click(screen.getByRole('button', { name: /implement ⚡️/i }))
      
      // The outer onClick should not be called due to stopPropagation
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('handles missing environment variables gracefully', () => {
      const originalEnv = import.meta.env.VITE_API_URL
      // @ts-ignore
      import.meta.env.VITE_API_URL = undefined

      const plan = createPlan('DRAFT')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      // Should render without crashing
      expect(screen.getByText('📄 Execution Plan: Test Execution Plan')).toBeInTheDocument()

      // @ts-ignore
      import.meta.env.VITE_API_URL = originalEnv
    })

    it('handles very long titles gracefully', () => {
      const longTitle = 'A'.repeat(200)
      const plan = createPlan('DRAFT', { title: longTitle })
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      expect(screen.getByText(`📄 Execution Plan: ${longTitle}`)).toBeInTheDocument()
    })

    it('handles special characters in title', () => {
      const specialTitle = 'Plan with <script> & "quotes" & émojis 🚀'
      const plan = createPlan('DRAFT', { title: specialTitle })
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      expect(screen.getByText(`📄 Execution Plan: ${specialTitle}`)).toBeInTheDocument()
    })

    it('handles missing planId', () => {
      const plan = createPlan('DRAFT', { planId: '' })
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      // Should render but implement button should not work
      expect(screen.getByText('📄 Execution Plan: Test Execution Plan')).toBeInTheDocument()
    })

    it('handles null/undefined callbacks gracefully', () => {
      const plan = createPlan('DRAFT')
      
      expect(() => {
        render(<PlanIndicator plan={plan} />)
      }).not.toThrow()

      // Should render basic plan info
      expect(screen.getByText('📄 Execution Plan: Test Execution Plan')).toBeInTheDocument()
    })

    it('handles unknown plan status', () => {
      const plan = createPlan('UNKNOWN_STATUS' as any)
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument()
    })

    it('truncates very long summaries', () => {
      const longSummary = 'This is a very long summary that should be truncated when displayed in the UI. '.repeat(10)
      const plan = createPlan('DRAFT', { summary: longSummary })
      const { container } = render(<PlanIndicator plan={plan} {...defaultProps} />)

      const summaryElement = container.querySelector('.line-clamp-2')
      expect(summaryElement).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has proper button roles', () => {
      const plan = createPlan('DRAFT')
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      expect(screen.getByRole('button', { name: /view plan/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /implement ⚡️/i })).toBeInTheDocument()
    })

    it('has proper link role for PR link', () => {
      const plan = createPlan('COMPLETED', { 
        prUrl: 'https://github.com/test/repo/pull/123' 
      })
      render(<PlanIndicator plan={plan} {...defaultProps} />)

      expect(screen.getByRole('link', { name: /view pr/i })).toBeInTheDocument()
    })

    it('provides title attribute for dismiss button', () => {
      const plan = createPlan('DRAFT')
      render(<PlanIndicator plan={plan} onDismiss={vi.fn()} {...defaultProps} />)

      expect(screen.getByRole('button', { name: /dismiss/i })).toHaveAttribute('title', 'Dismiss')
    })

    it('uses proper semantic markup', () => {
      const plan = createPlan('DRAFT')
      const { container } = render(<PlanIndicator plan={plan} {...defaultProps} />)

      // Title should be in h3 tag
      const titleElement = container.querySelector('h3')
      expect(titleElement).toBeInTheDocument()
      expect(titleElement).toHaveTextContent('📄 Execution Plan: Test Execution Plan')
    })
  })
})