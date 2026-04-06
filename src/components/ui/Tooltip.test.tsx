import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  it('renders children', () => {
    render(
      <Tooltip text="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    )
    
    expect(screen.getByRole('button')).toHaveTextContent('Hover me')
  })

  it('shows tooltip on mouse enter', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip text="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    )
    
    const button = screen.getByRole('button')
    
    // Tooltip should not be visible initially
    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument()
    
    // Hover over the trigger element
    await user.hover(button)
    
    // Tooltip should now be visible
    expect(screen.getByText('Tooltip text')).toBeInTheDocument()
  })

  it('hides tooltip on mouse leave', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip text="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    )
    
    const button = screen.getByRole('button')
    
    // Show tooltip
    await user.hover(button)
    expect(screen.getByText('Tooltip text')).toBeInTheDocument()
    
    // Hide tooltip
    await user.unhover(button)
    expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument()
  })

  describe('positioning', () => {
    // Mock getBoundingClientRect for positioning tests
    beforeEach(() => {
      Element.prototype.getBoundingClientRect = vi.fn(() => ({
        x: 100,
        y: 100,
        width: 50,
        height: 20,
        left: 100,
        top: 100,
        right: 150,
        bottom: 120,
        toJSON: vi.fn(),
      }))
    })

    it('positions tooltip at top by default', () => {
      render(
        <Tooltip text="Top tooltip">
          <button>Hover me</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      fireEvent.mouseEnter(button)
      
      const tooltip = screen.getByText('Top tooltip')
      expect(tooltip).toHaveStyle({
        position: 'fixed',
        left: '125px', // 100 + 50/2
        top: '94px', // 100 - 6
        transform: 'translate(-50%, -100%)',
      })
    })

    it('positions tooltip at bottom when position="bottom"', () => {
      render(
        <Tooltip text="Bottom tooltip" position="bottom">
          <button>Hover me</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      fireEvent.mouseEnter(button)
      
      const tooltip = screen.getByText('Bottom tooltip')
      expect(tooltip).toHaveStyle({
        position: 'fixed',
        left: '125px', // 100 + 50/2
        top: '126px', // 120 + 6
        transform: 'translateX(-50%)',
      })
    })

    it('positions tooltip at left when position="left"', () => {
      render(
        <Tooltip text="Left tooltip" position="left">
          <button>Hover me</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      fireEvent.mouseEnter(button)
      
      const tooltip = screen.getByText('Left tooltip')
      expect(tooltip).toHaveStyle({
        position: 'fixed',
        left: '94px', // 100 - 6
        top: '110px', // 100 + 20/2
        transform: 'translate(-100%, -50%)',
      })
    })

    it('positions tooltip at right when position="right"', () => {
      render(
        <Tooltip text="Right tooltip" position="right">
          <button>Hover me</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      fireEvent.mouseEnter(button)
      
      const tooltip = screen.getByText('Right tooltip')
      expect(tooltip).toHaveStyle({
        position: 'fixed',
        left: '156px', // 150 + 6
        top: '110px', // 100 + 20/2
        transform: 'translateY(-50%)',
      })
    })
  })

  describe('styling', () => {
    it('applies correct base classes to tooltip', async () => {
      const user = userEvent.setup()
      
      render(
        <Tooltip text="Styled tooltip">
          <button>Hover me</button>
        </Tooltip>
      )
      
      await user.hover(screen.getByRole('button'))
      
      const tooltip = screen.getByText('Styled tooltip')
      expect(tooltip.className).toContain('z-[9999]')
      expect(tooltip.className).toContain('px-2.5 py-1.5')
      expect(tooltip.className).toContain('text-[11px]')
      expect(tooltip.className).toContain('rounded-md')
      expect(tooltip.className).toContain('bg-gray-900')
      expect(tooltip.className).toContain('text-gray-100')
      expect(tooltip.className).toContain('whitespace-pre-line')
      expect(tooltip.className).toContain('pointer-events-none')
      expect(tooltip.className).toContain('shadow-lg')
      expect(tooltip.className).toContain('max-w-[240px]')
      expect(tooltip.className).toContain('text-left')
    })

    it('applies inline-flex class to container', () => {
      const { container } = render(
        <Tooltip text="Test">
          <button>Hover me</button>
        </Tooltip>
      )
      
      const tooltipContainer = container.firstChild as HTMLElement
      expect(tooltipContainer.className).toContain('inline-flex')
    })
  })

  describe('content handling', () => {
    it('handles multiline text with whitespace-pre-line', async () => {
      const user = userEvent.setup()
      const multilineText = 'Line 1\nLine 2\nLine 3'
      
      render(
        <Tooltip text={multilineText}>
          <button>Hover me</button>
        </Tooltip>
      )
      
      await user.hover(screen.getByRole('button'))
      
      // Use a more flexible text matcher for multiline content
      const tooltip = screen.getByText((_content, element) => {
        return element?.textContent === multilineText
      })
      expect(tooltip).toBeInTheDocument()
      expect(tooltip.className).toContain('whitespace-pre-line')
    })

    it('handles empty text', async () => {
      const user = userEvent.setup()
      
      render(
        <Tooltip text="">
          <button>Hover me</button>
        </Tooltip>
      )
      
      await user.hover(screen.getByRole('button'))
      
      // Find the tooltip span by its specific classes rather than empty text
      const tooltip = screen.getByRole('button').parentElement?.querySelector('.z-\\[9999\\]')
      expect(tooltip).toBeInTheDocument()
      expect(tooltip?.textContent).toBe('')
    })

    it('handles special characters in text', async () => {
      const user = userEvent.setup()
      const specialText = 'Special chars: <>&"\'`'
      
      render(
        <Tooltip text={specialText}>
          <button>Hover me</button>
        </Tooltip>
      )
      
      await user.hover(screen.getByRole('button'))
      
      expect(screen.getByText(specialText)).toBeInTheDocument()
    })
  })

  describe('interaction with different child elements', () => {
    it('works with text nodes', async () => {
      const user = userEvent.setup()
      
      render(
        <Tooltip text="Text tooltip">
          <span>Hover this text</span>
        </Tooltip>
      )
      
      await user.hover(screen.getByText('Hover this text'))
      expect(screen.getByText('Text tooltip')).toBeInTheDocument()
    })

    it('works with icons/images', async () => {
      const user = userEvent.setup()
      
      render(
        <Tooltip text="Icon tooltip">
          <img src="test.jpg" alt="Test icon" />
        </Tooltip>
      )
      
      await user.hover(screen.getByAltText('Test icon'))
      expect(screen.getByText('Icon tooltip')).toBeInTheDocument()
    })

    it('works with complex nested elements', async () => {
      const user = userEvent.setup()
      
      render(
        <Tooltip text="Complex tooltip">
          <div>
            <span>Complex</span>
            <strong>Content</strong>
          </div>
        </Tooltip>
      )
      
      const container = screen.getByText('Complex').parentElement!
      await user.hover(container)
      expect(screen.getByText('Complex tooltip')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles rapid mouse enter/leave events', async () => {
      const user = userEvent.setup()
      
      render(
        <Tooltip text="Rapid tooltip">
          <button>Hover me</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      
      // Rapid hover/unhover
      await user.hover(button)
      await user.unhover(button)
      await user.hover(button)
      await user.unhover(button)
      
      expect(screen.queryByText('Rapid tooltip')).not.toBeInTheDocument()
    })

    it('handles getBoundingClientRect returning null-like values', () => {
      Element.prototype.getBoundingClientRect = vi.fn(() => ({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        toJSON: vi.fn(),
      }))
      
      render(
        <Tooltip text="Zero rect tooltip">
          <button>Hover me</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      fireEvent.mouseEnter(button)
      
      const tooltip = screen.getByText('Zero rect tooltip')
      expect(tooltip).toBeInTheDocument()
    })

    it('handles mouse events using fireEvent', () => {
      render(
        <Tooltip text="FireEvent tooltip">
          <button>Hover me</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      
      // Show tooltip
      fireEvent.mouseEnter(button)
      expect(screen.getByText('FireEvent tooltip')).toBeInTheDocument()
      
      // Hide tooltip
      fireEvent.mouseLeave(button)
      expect(screen.queryByText('FireEvent tooltip')).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('tooltip does not interfere with child element accessibility', async () => {
      const user = userEvent.setup()
      const onClickMock = vi.fn()
      
      render(
        <Tooltip text="Button tooltip">
          <button onClick={onClickMock}>Click me</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      
      // Button should still be clickable
      await user.click(button)
      expect(onClickMock).toHaveBeenCalledTimes(1)
      
      // And tooltip should work on hover
      await user.hover(button)
      expect(screen.getByText('Button tooltip')).toBeInTheDocument()
    })

    it('tooltip has pointer-events-none to not interfere with interactions', async () => {
      const user = userEvent.setup()
      
      render(
        <Tooltip text="Non-interactive tooltip">
          <button>Hover me</button>
        </Tooltip>
      )
      
      await user.hover(screen.getByRole('button'))
      
      const tooltip = screen.getByText('Non-interactive tooltip')
      expect(tooltip.className).toContain('pointer-events-none')
    })
  })
})