import { render, screen, fireEvent } from '@testing-library/react'
import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb'

// Mock lucide-react
vi.mock('lucide-react', () => ({
  ChevronRight: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="chevron-right" data-size={size} className={className} />
  ),
}))

// Mock Tooltip component
vi.mock('./Tooltip', () => ({
  Tooltip: ({ text, children, position }: { text: string; children: React.ReactNode; position?: string }) => (
    <div data-testid="tooltip-wrapper" data-tooltip-text={text} data-position={position}>
      {children}
    </div>
  ),
}))

const createBreadcrumbItem = (overrides: Partial<BreadcrumbItem> = {}): BreadcrumbItem => ({
  label: 'Test Item',
  ...overrides,
})

describe('Breadcrumb', () => {
  it('returns null when items array is empty', () => {
    const { container } = render(<Breadcrumb items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders single breadcrumb item', () => {
    const items = [createBreadcrumbItem({ label: 'Single Item' })]
    
    render(<Breadcrumb items={items} />)
    
    expect(screen.getByText('Single Item')).toBeInTheDocument()
    // Should not have any chevron separators
    expect(screen.queryByTestId('chevron-right')).not.toBeInTheDocument()
  })

  it('renders multiple breadcrumb items with separators', () => {
    const items = [
      createBreadcrumbItem({ label: 'First' }),
      createBreadcrumbItem({ label: 'Second' }),
      createBreadcrumbItem({ label: 'Third' }),
    ]
    
    render(<Breadcrumb items={items} />)
    
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getByText('Third')).toBeInTheDocument()
    
    // Should have 2 chevron separators (n-1 separators for n items)
    expect(screen.getAllByTestId('chevron-right')).toHaveLength(2)
  })

  describe('breadcrumb items with badges', () => {
    it('renders badge when provided', () => {
      const items = [
        createBreadcrumbItem({
          label: 'Item with Badge',
          badge: {
            text: 'NEW',
            className: 'bg-blue-100 text-blue-800'
          }
        })
      ]
      
      render(<Breadcrumb items={items} />)
      
      expect(screen.getByText('NEW')).toBeInTheDocument()
      expect(screen.getByText('Item with Badge')).toBeInTheDocument()
      
      const badge = screen.getByText('NEW')
      expect(badge.className).toContain('bg-blue-100')
      expect(badge.className).toContain('text-blue-800')
      expect(badge.className).toContain('font-medium')
      expect(badge.className).toContain('px-1 py-0')
      expect(badge.className).toContain('text-[9px]')
    })

    it('renders without badge when not provided', () => {
      const items = [createBreadcrumbItem({ label: 'No Badge Item' })]
      
      const { container } = render(<Breadcrumb items={items} />)
      
      expect(screen.getByText('No Badge Item')).toBeInTheDocument()
      // Should not have any badge elements
      expect(container.querySelector('.font-medium.px-1')).toBeNull()
    })
  })

  describe('breadcrumb items with tooltips', () => {
    it('wraps item in tooltip when tooltip text is provided', () => {
      const items = [
        createBreadcrumbItem({
          label: 'Item with Tooltip',
          tooltip: 'This is a helpful tooltip'
        })
      ]
      
      render(<Breadcrumb items={items} />)
      
      const tooltipWrapper = screen.getByTestId('tooltip-wrapper')
      expect(tooltipWrapper).toBeInTheDocument()
      expect(tooltipWrapper).toHaveAttribute('data-tooltip-text', 'This is a helpful tooltip')
      expect(tooltipWrapper).toHaveAttribute('data-position', 'bottom')
      expect(screen.getByText('Item with Tooltip')).toBeInTheDocument()
    })

    it('does not wrap in tooltip when tooltip text is not provided', () => {
      const items = [createBreadcrumbItem({ label: 'No Tooltip Item' })]
      
      render(<Breadcrumb items={items} />)
      
      expect(screen.queryByTestId('tooltip-wrapper')).not.toBeInTheDocument()
      expect(screen.getByText('No Tooltip Item')).toBeInTheDocument()
    })
  })

  describe('breadcrumb items with links', () => {
    it('renders as link when href is provided', () => {
      const items = [
        createBreadcrumbItem({
          label: 'Linked Item',
          href: 'https://example.com'
        })
      ]
      
      render(<Breadcrumb items={items} />)
      
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', 'https://example.com')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      expect(link).toHaveTextContent('Linked Item')
      expect(link.className).toContain('hover:opacity-75')
      expect(link.className).toContain('transition-opacity')
    })

    it('renders as span when href is not provided', () => {
      const items = [createBreadcrumbItem({ label: 'Not Linked' })]
      
      render(<Breadcrumb items={items} />)
      
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(screen.getByText('Not Linked')).toBeInTheDocument()
    })

    it('stops propagation on link click', () => {
      const items = [
        createBreadcrumbItem({
          label: 'Linked Item',
          href: 'https://example.com'
        })
      ]
      
      const parentClickHandler = vi.fn()
      
      render(
        <div onClick={parentClickHandler}>
          <Breadcrumb items={items} />
        </div>
      )
      
      const link = screen.getByRole('link')
      fireEvent.click(link)
      
      // Parent click should not be called due to stopPropagation
      expect(parentClickHandler).not.toHaveBeenCalled()
    })
  })

  describe('complex breadcrumb items', () => {
    it('renders item with all features (badge, tooltip, link)', () => {
      const items = [
        createBreadcrumbItem({
          label: 'Complex Item',
          badge: {
            text: 'VIP',
            className: 'bg-gold text-black'
          },
          tooltip: 'This is a complex item',
          href: 'https://example.com/complex'
        })
      ]
      
      render(<Breadcrumb items={items} />)
      
      // Check badge
      expect(screen.getByText('VIP')).toBeInTheDocument()
      const badge = screen.getByText('VIP')
      expect(badge.className).toContain('bg-gold')
      expect(badge.className).toContain('text-black')
      
      // Check tooltip wrapper
      const tooltipWrapper = screen.getByTestId('tooltip-wrapper')
      expect(tooltipWrapper).toHaveAttribute('data-tooltip-text', 'This is a complex item')
      
      // Check link
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', 'https://example.com/complex')
      
      // Check label
      expect(screen.getByText('Complex Item')).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('applies default container classes', () => {
      const items = [createBreadcrumbItem()]
      const { container } = render(<Breadcrumb items={items} />)
      
      const breadcrumbContainer = container.firstChild as HTMLElement
      expect(breadcrumbContainer.className).toContain('flex')
      expect(breadcrumbContainer.className).toContain('items-center')
      expect(breadcrumbContainer.className).toContain('gap-1')
      expect(breadcrumbContainer.className).toContain('flex-nowrap')
      expect(breadcrumbContainer.className).toContain('overflow-hidden')
    })

    it('applies custom className', () => {
      const items = [createBreadcrumbItem()]
      const { container } = render(<Breadcrumb items={items} className="custom-class" />)
      
      const breadcrumbContainer = container.firstChild as HTMLElement
      expect(breadcrumbContainer.className).toContain('custom-class')
    })

    it('applies font and color classes to labels', () => {
      const items = [createBreadcrumbItem({ label: 'Styled Label' })]
      
      render(<Breadcrumb items={items} />)
      
      const label = screen.getByText('Styled Label')
      expect(label.className).toContain('font-mono')
      expect(label.className).toContain('text-[var(--color-fonts-font-color-brand)]')
    })

    it('applies correct size to chevron separators', () => {
      const items = [
        createBreadcrumbItem({ label: 'First' }),
        createBreadcrumbItem({ label: 'Second' }),
      ]
      
      render(<Breadcrumb items={items} />)
      
      const chevron = screen.getByTestId('chevron-right')
      expect(chevron).toHaveAttribute('data-size', '10')
      expect(chevron.className).toContain('shrink-0')
      expect(chevron.className).toContain('text-[var(--color-fonts-font-color-support)]')
      expect(chevron.className).toContain('opacity-50')
    })

    it('applies sizing classes to item containers', () => {
      const items = [createBreadcrumbItem({ label: 'Container Test' })]
      const { container } = render(<Breadcrumb items={items} />)
      
      const itemContainer = container.querySelector('.flex.items-center.gap-1.min-w-0')
      expect(itemContainer).toBeInTheDocument()
      
      const innerContainer = container.querySelector('.shrink-0')
      expect(innerContainer).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('maintains proper semantic structure', () => {
      const items = [
        createBreadcrumbItem({ label: 'Home', href: '/home' }),
        createBreadcrumbItem({ label: 'Category' }),
        createBreadcrumbItem({ label: 'Current Page' }),
      ]
      
      render(<Breadcrumb items={items} />)
      
      // Should have one link
      const links = screen.getAllByRole('link')
      expect(links).toHaveLength(1)
      expect(links[0]).toHaveTextContent('Home')
      
      // Should have all text content visible
      expect(screen.getByText('Category')).toBeInTheDocument()
      expect(screen.getByText('Current Page')).toBeInTheDocument()
    })

    it('uses appropriate key prop for list items', () => {
      const items = [
        createBreadcrumbItem({ label: 'Item1' }),
        createBreadcrumbItem({ label: 'Item2' }),
        // Test duplicate labels (should still work with index)
        createBreadcrumbItem({ label: 'Item1' }),
      ]
      
      render(<Breadcrumb items={items} />)
      
      // All items should render correctly even with duplicate labels
      expect(screen.getAllByText('Item1')).toHaveLength(2)
      expect(screen.getByText('Item2')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles empty label gracefully', () => {
      const items = [createBreadcrumbItem({ label: '' })]
      
      render(<Breadcrumb items={items} />)
      
      // Should render without crashing, though label will be empty
      const { container } = render(<Breadcrumb items={items} />)
      expect(container.firstChild).toBeInTheDocument()
    })

    it('handles very long labels', () => {
      const items = [
        createBreadcrumbItem({ 
          label: 'This is a very long breadcrumb label that might overflow the container'
        })
      ]
      
      render(<Breadcrumb items={items} />)
      
      const label = screen.getByText('This is a very long breadcrumb label that might overflow the container')
      expect(label).toBeInTheDocument()
    })

    it('handles special characters in labels and tooltips', () => {
      const items = [
        createBreadcrumbItem({
          label: 'Label with <>&"\'` chars',
          tooltip: 'Tooltip with <>&"\'` chars'
        })
      ]
      
      render(<Breadcrumb items={items} />)
      
      expect(screen.getByText('Label with <>&"\'` chars')).toBeInTheDocument()
      const tooltipWrapper = screen.getByTestId('tooltip-wrapper')
      expect(tooltipWrapper).toHaveAttribute('data-tooltip-text', 'Tooltip with <>&"\'` chars')
    })

    it('handles undefined className gracefully', () => {
      const items = [createBreadcrumbItem()]
      const { container } = render(<Breadcrumb items={items} className={undefined} />)
      
      const breadcrumbContainer = container.firstChild as HTMLElement
      expect(breadcrumbContainer).toBeInTheDocument()
    })
  })
})