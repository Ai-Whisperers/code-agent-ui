import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Select, type SelectOption } from './Select'

// Mock lucide-react
vi.mock('lucide-react', () => ({
  ChevronDown: ({ className }: { className?: string }) => (
    <div data-testid="chevron-down" className={className} />
  ),
  Check: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="check" data-size={size} className={className} />
  ),
}))

const mockOptions: SelectOption[] = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' },
]

describe('Select', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    options: mockOptions,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with default props', () => {
    render(<Select {...defaultProps} />)
    
    const trigger = screen.getByRole('button')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveTextContent('Select…')
    expect(screen.getByTestId('chevron-down')).toBeInTheDocument()
  })

  it('shows custom placeholder', () => {
    render(<Select {...defaultProps} placeholder="Choose an option" />)
    
    expect(screen.getByRole('button')).toHaveTextContent('Choose an option')
  })

  it('displays selected option label', () => {
    render(<Select {...defaultProps} value="option2" />)
    
    expect(screen.getByRole('button')).toHaveTextContent('Option 2')
  })

  describe('dropdown functionality', () => {
    it('opens dropdown when trigger is clicked', () => {
      render(<Select {...defaultProps} />)
      
      // Dropdown should not be visible initially
      expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
      
      // Click trigger
      fireEvent.click(screen.getByRole('button'))
      
      // Dropdown should be visible
      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
      expect(screen.getByText('Option 3')).toBeInTheDocument()
    })

    it('closes dropdown when trigger is clicked while open', () => {
      render(<Select {...defaultProps} />)
      
      const trigger = screen.getByRole('button')
      
      // Open dropdown
      fireEvent.click(trigger)
      expect(screen.getByText('Option 1')).toBeInTheDocument()
      
      // Click again to close
      fireEvent.click(trigger)
      expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
    })

    it('calls onChange when option is selected', () => {
      const onChange = vi.fn()
      render(<Select {...defaultProps} onChange={onChange} />)
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'))
      
      // Click an option
      fireEvent.click(screen.getByText('Option 2'))
      
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith('option2')
    })

    it('closes dropdown after selecting an option', () => {
      render(<Select {...defaultProps} />)
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'))
      expect(screen.getByText('Option 1')).toBeInTheDocument()
      
      // Select an option
      fireEvent.click(screen.getByText('Option 2'))
      
      // Dropdown should be closed
      expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
    })

    it('highlights selected option with check icon', () => {
      render(<Select {...defaultProps} value="option2" />)
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'))
      
      const optionButtons = screen.getAllByRole('button').slice(1) // Exclude trigger
      const selectedOption = optionButtons.find(btn => btn.textContent?.includes('Option 2'))
      
      expect(selectedOption?.className).toContain('font-medium')
      expect(selectedOption?.className).toContain('text-[var(--color-fonts-font-color-primary)]')
    })

    it('shows check icon for selected option and hides for others', () => {
      render(<Select {...defaultProps} value="option2" />)
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'))
      
      const checkIcons = screen.getAllByTestId('check')
      
      // All options should have check icons, but only selected one should be visible
      expect(checkIcons).toHaveLength(3)
      
      // Check that the selected option's check is visible and others are not
      checkIcons.forEach((icon, index) => {
        if (index === 1) { // Option 2 is selected (0-indexed)
          expect(icon.className).toContain('opacity-100')
        } else {
          expect(icon.className).toContain('opacity-0')
        }
      })
    })
  })

  describe('styling', () => {
    it('applies open styling when dropdown is open', () => {
      render(<Select {...defaultProps} />)
      
      const trigger = screen.getByRole('button')
      
      // Initially closed
      expect(trigger.className).toContain('border-[var(--color-cards-card-stroke)]')
      
      // Open dropdown
      fireEvent.click(trigger)
      
      expect(trigger.className).toContain('border-[var(--color-buttons-button-primary)]')
    })

    it('rotates chevron when dropdown is open', () => {
      render(<Select {...defaultProps} />)
      
      const chevron = screen.getByTestId('chevron-down')
      
      // Initially not rotated
      expect(chevron.className).not.toContain('rotate-180')
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'))
      
      expect(chevron.className).toContain('rotate-180')
    })

    it('applies different text color for selected vs placeholder', () => {
      const { rerender } = render(<Select {...defaultProps} />)
      
      const trigger = screen.getByRole('button')
      const textSpan = trigger.querySelector('span')
      
      // Placeholder styling
      expect(textSpan?.className).toContain('text-[var(--color-fonts-font-color-support)]')
      
      rerender(<Select {...defaultProps} value="option1" />)
      
      // Selected option styling
      expect(textSpan?.className).toContain('text-[var(--color-fonts-font-color-user-input)]')
    })

    it('applies custom className', () => {
      const { container } = render(<Select {...defaultProps} className="custom-class" />)
      
      const selectContainer = container.firstChild as HTMLElement
      expect(selectContainer.className).toContain('custom-class')
    })
  })

  describe('disabled state', () => {
    it('disables trigger when disabled=true', () => {
      render(<Select {...defaultProps} disabled />)
      
      const trigger = screen.getByRole('button')
      expect(trigger).toBeDisabled()
      expect(trigger.className).toContain('disabled:opacity-50')
      expect(trigger.className).toContain('disabled:cursor-not-allowed')
    })

    it('does not open dropdown when disabled', () => {
      render(<Select {...defaultProps} disabled />)
      
      fireEvent.click(screen.getByRole('button'))
      expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
    })
  })

  describe('keyboard interactions', () => {
    it('closes dropdown when Escape is pressed', async () => {
      const user = userEvent.setup()
      render(<Select {...defaultProps} />)
      
      // Open dropdown
      await user.click(screen.getByRole('button'))
      expect(screen.getByText('Option 1')).toBeInTheDocument()
      
      // Press Escape
      await user.keyboard('{Escape}')
      
      await waitFor(() => {
        expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
      })
    })
  })

  describe('click outside behavior', () => {
    it('closes dropdown when clicking outside', async () => {
      render(
        <div>
          <Select {...defaultProps} />
          <div data-testid="outside">Outside element</div>
        </div>
      )
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'))
      expect(screen.getByText('Option 1')).toBeInTheDocument()
      
      // Click outside
      fireEvent.mouseDown(screen.getByTestId('outside'))
      
      await waitFor(() => {
        expect(screen.queryByText('Option 1')).not.toBeInTheDocument()
      })
    })

    it('does not close dropdown when clicking inside', () => {
      render(<Select {...defaultProps} />)
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'))
      expect(screen.getByText('Option 1')).toBeInTheDocument()
      
      // Click inside dropdown (on the container)
      const dropdown = screen.getByText('Option 1').closest('div')
      fireEvent.mouseDown(dropdown!)
      
      expect(screen.getByText('Option 1')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles empty options array', () => {
      render(<Select {...defaultProps} options={[]} />)
      
      const trigger = screen.getByRole('button')
      expect(trigger).toBeInTheDocument()
      
      // Open dropdown
      fireEvent.click(trigger)
      
      // No options should be rendered
      const dropdownContent = trigger.parentElement?.querySelector('.absolute')
      expect(dropdownContent?.children).toHaveLength(0)
    })

    it('handles value that does not exist in options', () => {
      render(<Select {...defaultProps} value="nonexistent" />)
      
      // Should show placeholder when value doesn't match any option
      expect(screen.getByRole('button')).toHaveTextContent('Select…')
    })

    it('handles options with same value', () => {
      const duplicateOptions = [
        { value: 'duplicate', label: 'First' },
        { value: 'duplicate', label: 'Second' },
      ]
      
      render(<Select {...defaultProps} options={duplicateOptions} value="duplicate" />)
      
      // Should use first matching option
      expect(screen.getByRole('button')).toHaveTextContent('First')
    })

    it('handles very long option labels', () => {
      const longOptions = [
        { value: 'long', label: 'This is a very long option label that should be truncated' }
      ]
      
      render(<Select {...defaultProps} options={longOptions} />)
      
      // Open dropdown
      fireEvent.click(screen.getByRole('button'))
      
      const option = screen.getByText('This is a very long option label that should be truncated')
      expect(option).toBeInTheDocument()
      expect(option.className).toContain('whitespace-nowrap')
    })

    it('cleans up event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
      
      const { unmount } = render(<Select {...defaultProps} />)
      
      unmount()
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })
  })

  describe('accessibility', () => {
    it('uses button elements for trigger and options', () => {
      render(<Select {...defaultProps} />)
      
      fireEvent.click(screen.getByRole('button'))
      
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(4) // 1 trigger + 3 options
    })

    it('maintains focus management', () => {
      render(<Select {...defaultProps} />)
      
      const trigger = screen.getByRole('button')
      
      // Focus trigger
      trigger.focus()
      expect(trigger).toHaveFocus()
      
      // Open dropdown
      fireEvent.click(trigger)
      
      // Trigger should still be focusable
      expect(trigger).toBeInTheDocument()
    })
  })
})