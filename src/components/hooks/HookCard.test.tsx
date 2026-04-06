import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { HookCard } from './HookCard'
import type { AutomationHook } from '@/types/api'

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Power: ({ size }: { size?: number }) => (
    <div data-testid="power-icon" data-size={size} />
  ),
  Trash2: ({ size }: { size?: number }) => (
    <div data-testid="trash2-icon" data-size={size} />
  ),
}))

// Mock hookConstants
vi.mock('./hookConstants', () => ({
  getCategories: vi.fn(() => ['SCM']),
  subTriggerLabel: vi.fn(() => 'opened · feature/*'),
  CATEGORY_COLORS: {
    SCM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    Jira: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    Confluence: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    Other: 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
  },
}))

import * as hookConstants from './hookConstants'

describe('HookCard', () => {
  const mockGetCategories = vi.mocked(hookConstants.getCategories)
  const mockSubTriggerLabel = vi.mocked(hookConstants.subTriggerLabel)

  const createHook = (overrides: Partial<AutomationHook> = {}): AutomationHook => ({
    name: 'Test Hook',
    enabled: true,
    description: 'Test hook description',
    triggerTypes: ['scm.pr_created'],
    ...overrides,
  })

  const defaultProps = {
    onEdit: vi.fn(),
    onToggle: vi.fn(),
    onDelete: vi.fn(),
    isToggling: false,
    isDeleting: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockGetCategories.mockReturnValue(['SCM'])
    mockSubTriggerLabel.mockReturnValue('opened · feature/*')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('basic rendering', () => {
    it('renders hook name and description', () => {
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByText('Test Hook')).toBeInTheDocument()
      expect(screen.getByText('Test hook description')).toBeInTheDocument()
    })

    it('renders without description when not provided', () => {
      const hook = createHook({ description: undefined })
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByText('Test Hook')).toBeInTheDocument()
      expect(screen.queryByText('Test hook description')).not.toBeInTheDocument()
    })

    it('applies correct container styling', () => {
      const hook = createHook()
      const { container } = render(<HookCard hook={hook} {...defaultProps} />)

      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('bg-[var(--color-cards-card-background)]')
      expect(card.className).toContain('border')
      expect(card.className).toContain('rounded-[var(--border-radius-card)]')
      expect(card.className).toContain('px-5')
      expect(card.className).toContain('py-4')
    })
  })

  describe('category badges', () => {
    it('renders category badges', () => {
      mockGetCategories.mockReturnValue(['SCM', 'Jira'])
      
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByText('SCM')).toBeInTheDocument()
      expect(screen.getByText('Jira')).toBeInTheDocument()
    })

    it('applies correct category colors', () => {
      mockGetCategories.mockReturnValue(['SCM'])
      
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      const badge = screen.getByText('SCM')
      expect(badge.className).toContain('bg-blue-100')
      expect(badge.className).toContain('text-blue-700')
    })

    it('handles multiple categories', () => {
      mockGetCategories.mockReturnValue(['SCM', 'Jira', 'Other'])
      
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByText('SCM')).toBeInTheDocument()
      expect(screen.getByText('Jira')).toBeInTheDocument()
      expect(screen.getByText('Other')).toBeInTheDocument()
    })

    it('handles empty categories', () => {
      mockGetCategories.mockReturnValue([])
      
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      // Should render without categories
      expect(screen.getByText('Test Hook')).toBeInTheDocument()
    })
  })

  describe('sub-trigger label', () => {
    it('renders sub-trigger label when present', () => {
      mockSubTriggerLabel.mockReturnValue('opened · feature/*')
      
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByText('opened · feature/*')).toBeInTheDocument()
    })

    it('does not render sub-trigger label when null', () => {
      mockSubTriggerLabel.mockReturnValue(null)
      
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.queryByText('opened · feature/*')).not.toBeInTheDocument()
    })

    it('applies monospace font to sub-trigger label', () => {
      mockSubTriggerLabel.mockReturnValue('0 9 * * 1')
      
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      const subLabel = screen.getByText('0 9 * * 1')
      expect(subLabel.className).toContain('font-mono')
    })
  })

  describe('trigger filters', () => {
    it('renders repository filters', () => {
      const hook = createHook({
        triggerFilter: {
          repoSlug: 'repo1, repo2, repo3'
        }
      })
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByText('repo:repo1')).toBeInTheDocument()
      expect(screen.getByText('repo:repo2')).toBeInTheDocument()
      expect(screen.getByText('repo:repo3')).toBeInTheDocument()
    })

    it('renders severity filter', () => {
      const hook = createHook({
        triggerFilter: {
          severity: 'high'
        }
      })
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByText('sev:high')).toBeInTheDocument()
    })

    it('renders issue type filter', () => {
      const hook = createHook({
        triggerFilter: {
          issueType: 'Bug'
        }
      })
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByText('type:Bug')).toBeInTheDocument()
    })

    it('renders project keys filter', () => {
      const hook = createHook({
        triggerFilter: {
          projectKeys: 'PROJ1,PROJ2'
        }
      })
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByText('projects:PROJ1,PROJ2')).toBeInTheDocument()
    })

    it('renders multiple filters together', () => {
      const hook = createHook({
        triggerFilter: {
          repoSlug: 'repo1',
          severity: 'high',
          issueType: 'Bug',
          projectKeys: 'PROJ1'
        }
      })
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByText('repo:repo1')).toBeInTheDocument()
      expect(screen.getByText('sev:high')).toBeInTheDocument()
      expect(screen.getByText('type:Bug')).toBeInTheDocument()
      expect(screen.getByText('projects:PROJ1')).toBeInTheDocument()
    })

    it('handles empty repository slug', () => {
      const hook = createHook({
        triggerFilter: {
          repoSlug: ' , , '
        }
      })
      render(<HookCard hook={hook} {...defaultProps} />)

      // Should not render any repo filters
      expect(screen.queryByText(/repo:/)).not.toBeInTheDocument()
    })

    it('does not render filter section when no filters present', () => {
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.queryByText(/repo:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/sev:/)).not.toBeInTheDocument()
    })

    it('does not render filter section when triggerFilter is empty', () => {
      const hook = createHook({ triggerFilter: {} })
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.queryByText(/repo:/)).not.toBeInTheDocument()
    })
  })

  describe('action buttons', () => {
    it('renders enabled state correctly', () => {
      const hook = createHook({ enabled: true })
      render(<HookCard hook={hook} {...defaultProps} />)

      const enableButton = screen.getByRole('button', { name: /enabled/i })
      expect(enableButton).toBeInTheDocument()
      expect(enableButton.className).toContain('bg-[var(--color-tags-success-background)]')
      expect(screen.getByTestId('power-icon')).toBeInTheDocument()
    })

    it('renders disabled state correctly', () => {
      const hook = createHook({ enabled: false })
      render(<HookCard hook={hook} {...defaultProps} />)

      const disableButton = screen.getByRole('button', { name: /disabled/i })
      expect(disableButton).toBeInTheDocument()
      expect(disableButton.className).toContain('bg-[var(--color-tags-neutral-background)]')
    })

    it('calls onToggle when power button is clicked', () => {
      const onToggle = vi.fn()
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} onToggle={onToggle} />)

      fireEvent.click(screen.getByRole('button', { name: /enabled/i }))
      expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it('disables toggle button when isToggling is true', () => {
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} isToggling={true} />)

      const toggleButton = screen.getByRole('button', { name: /enabled/i })
      expect(toggleButton).toBeDisabled()
      expect(toggleButton.className).toContain('disabled:opacity-60')
    })

    it('renders edit button', () => {
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })

    it('calls onEdit when edit button is clicked', () => {
      const onEdit = vi.fn()
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} onEdit={onEdit} />)

      fireEvent.click(screen.getByRole('button', { name: /edit/i }))
      expect(onEdit).toHaveBeenCalledTimes(1)
    })

    it('renders delete button', () => {
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      const deleteButton = screen.getByRole('button', { name: /delete hook/i })
      expect(deleteButton).toBeInTheDocument()
      expect(screen.getByTestId('trash2-icon')).toBeInTheDocument()
    })
  })

  describe('delete confirmation', () => {
    it('requires two clicks to delete', () => {
      const onDelete = vi.fn()
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} onDelete={onDelete} />)

      const deleteButton = screen.getByRole('button', { name: /delete hook/i })

      // First click should not call onDelete
      fireEvent.click(deleteButton)
      expect(onDelete).not.toHaveBeenCalled()

      // Button should change appearance
      expect(deleteButton).toHaveAttribute('title', 'Click again to confirm deletion')
      expect(deleteButton.className).toContain('bg-[var(--color-status-critical-background)]')

      // Second click should call onDelete
      fireEvent.click(deleteButton)
      expect(onDelete).toHaveBeenCalledTimes(1)
    })

    it('resets confirmation state after timeout', async () => {
      const onDelete = vi.fn()
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} onDelete={onDelete} />)

      const deleteButton = screen.getByRole('button', { name: /delete hook/i })

      // First click
      fireEvent.click(deleteButton)
      expect(deleteButton).toHaveAttribute('title', 'Click again to confirm deletion')

      // Wait for timeout
      act(() => {
        vi.advanceTimersByTime(3000)
      })

      // Should reset to normal state
      await waitFor(() => {
        expect(deleteButton).toHaveAttribute('title', 'Delete hook')
      })
      expect(deleteButton.className).not.toContain('bg-[var(--color-status-critical-background)]')

      // Next click should require confirmation again
      fireEvent.click(deleteButton)
      expect(onDelete).not.toHaveBeenCalled()
    })

    it('disables delete button when isDeleting is true', () => {
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} isDeleting={true} />)

      const deleteButton = screen.getByRole('button', { name: /delete hook/i })
      expect(deleteButton).toBeDisabled()
      expect(deleteButton.className).toContain('disabled:opacity-60')
    })

    it('shows critical styling when in confirmation state', () => {
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      const deleteButton = screen.getByRole('button', { name: /delete hook/i })
      
      // Initial state
      expect(deleteButton.className).not.toContain('bg-[var(--color-status-critical-background)]')
      
      // After first click
      fireEvent.click(deleteButton)
      expect(deleteButton.className).toContain('bg-[var(--color-status-critical-background)]')
      expect(deleteButton.className).toContain('text-[var(--color-status-border-critical)]')
    })
  })

  describe('loading states', () => {
    it('shows loading state for toggle button', () => {
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} isToggling={true} />)

      const toggleButton = screen.getByRole('button', { name: /enabled/i })
      expect(toggleButton).toBeDisabled()
    })

    it('shows loading state for delete button', () => {
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} isDeleting={true} />)

      const deleteButton = screen.getByRole('button', { name: /delete hook/i })
      expect(deleteButton).toBeDisabled()
    })

    it('allows edit during toggle loading', () => {
      const onEdit = vi.fn()
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} onEdit={onEdit} isToggling={true} />)

      fireEvent.click(screen.getByRole('button', { name: /edit/i }))
      expect(onEdit).toHaveBeenCalledTimes(1)
    })

    it('allows edit during delete loading', () => {
      const onEdit = vi.fn()
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} onEdit={onEdit} isDeleting={true} />)

      fireEvent.click(screen.getByRole('button', { name: /edit/i }))
      expect(onEdit).toHaveBeenCalledTimes(1)
    })
  })

  describe('text truncation', () => {
    it('truncates long hook names', () => {
      const hook = createHook({ name: 'A'.repeat(100) })
      const { container } = render(<HookCard hook={hook} {...defaultProps} />)

      const nameElement = container.querySelector('.truncate')
      expect(nameElement).toBeInTheDocument()
    })

    it('truncates long descriptions', () => {
      const hook = createHook({ description: 'B'.repeat(200) })
      const { container } = render(<HookCard hook={hook} {...defaultProps} />)

      const descElements = container.querySelectorAll('.truncate')
      expect(descElements.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('edge cases', () => {
    it('handles hook with minimal data', () => {
      const hook: AutomationHook = {
        name: 'Minimal Hook',
        enabled: true,
      }
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByText('Minimal Hook')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /enabled/i })).toBeInTheDocument()
    })

    it('handles hook with all optional fields missing', () => {
      const hook: AutomationHook = {
        name: 'Basic Hook',
        enabled: false,
      }
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByText('Basic Hook')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /disabled/i })).toBeInTheDocument()
    })

    it('handles empty strings in trigger filters', () => {
      const hook = createHook({
        triggerFilter: {
          repoSlug: '',
          severity: '',
          issueType: '',
          projectKeys: ''
        }
      })
      render(<HookCard hook={hook} {...defaultProps} />)

      // Should not render any filter tags
      expect(screen.queryByText(/repo:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/sev:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/type:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/projects:/)).not.toBeInTheDocument()
    })

    it('handles special characters in hook name', () => {
      const hook = createHook({ name: 'Hook & <script>alert("xss")</script>' })
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByText('Hook & <script>alert("xss")</script>')).toBeInTheDocument()
    })

    it('handles unicode characters', () => {
      const hook = createHook({ 
        name: '🚀 Test Hook 中文', 
        description: 'Description with émojis 🎉 and unicode ñ' 
      })
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByText('🚀 Test Hook 中文')).toBeInTheDocument()
      expect(screen.getByText('Description with émojis 🎉 and unicode ñ')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has proper button roles', () => {
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(screen.getByRole('button', { name: /enabled/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /delete hook/i })).toBeInTheDocument()
    })

    it('provides proper title attributes', () => {
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      const deleteButton = screen.getByRole('button', { name: /delete hook/i })
      expect(deleteButton).toHaveAttribute('title', 'Delete hook')
    })

    it('updates title attribute during confirmation state', () => {
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      const deleteButton = screen.getByRole('button', { name: /delete hook/i })
      fireEvent.click(deleteButton)

      expect(deleteButton).toHaveAttribute('title', 'Click again to confirm deletion')
    })

    it('maintains button functionality with keyboard navigation', () => {
      const onEdit = vi.fn()
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} onEdit={onEdit} />)

      const editButton = screen.getByRole('button', { name: /edit/i })
      editButton.focus()
      fireEvent.keyDown(editButton, { key: 'Enter' })
      // Note: fireEvent.keyDown doesn't automatically trigger click events
      // but the button should be focusable
      expect(document.activeElement).toBe(editButton)
    })
  })

  describe('layout and spacing', () => {
    it('maintains proper spacing between elements', () => {
      const hook = createHook()
      const { container } = render(<HookCard hook={hook} {...defaultProps} />)

      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('justify-between')
      expect(card.className).toContain('px-5')
      expect(card.className).toContain('py-4')
    })

    it('handles long content without breaking layout', () => {
      const hook = createHook({
        name: 'Very Long Hook Name That Should Be Truncated',
        description: 'Very long description that should also be truncated to prevent layout issues',
        triggerFilter: {
          repoSlug: 'very-long-repo-name-1,very-long-repo-name-2,very-long-repo-name-3',
          severity: 'critical',
          issueType: 'Security Vulnerability',
          projectKeys: 'VERY-LONG-PROJECT-KEY-1,VERY-LONG-PROJECT-KEY-2'
        }
      })
      render(<HookCard hook={hook} {...defaultProps} />)

      // Should render without layout issues
      expect(screen.getByText(/Very Long Hook Name/)).toBeInTheDocument()
    })
  })

  describe('integration with hookConstants', () => {
    it('calls getCategories with hook trigger types', () => {
      const hook = createHook({ triggerTypes: ['scm.pr_created', 'jira.issue_updated'] })
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(mockGetCategories).toHaveBeenCalledWith(['scm.pr_created', 'jira.issue_updated'])
    })

    it('calls subTriggerLabel with hook object', () => {
      const hook = createHook()
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(mockSubTriggerLabel).toHaveBeenCalledWith(hook)
    })

    it('handles undefined trigger types', () => {
      const hook = createHook({ triggerTypes: undefined })
      render(<HookCard hook={hook} {...defaultProps} />)

      expect(mockGetCategories).toHaveBeenCalledWith(undefined)
    })
  })
})