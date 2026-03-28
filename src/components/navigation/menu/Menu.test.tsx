import { render, screen, fireEvent } from '@testing-library/react'
import { Menu } from './Menu'
import type { NavigationMenuItem } from '@/config/applicationMenu'

// Mock lucide-react
vi.mock('lucide-react', () => ({
  ChevronDown: ({ className }: { className?: string }) => (
    <div data-testid="chevron-down" className={className} />
  ),
}))

const createMenuItem = (overrides: Partial<NavigationMenuItem> = {}): NavigationMenuItem => ({
  id: 'test-item',
  label: 'Test Item',
  type: 'item',
  ...overrides,
})

const createParentMenuItem = (children: NavigationMenuItem[], overrides: Partial<NavigationMenuItem> = {}): NavigationMenuItem => ({
  id: 'test-parent',
  label: 'Test Parent',
  type: 'parent',
  children,
  ...overrides,
})

describe('Menu', () => {
  describe('when collapsed (isExpanded=false)', () => {
    it('renders menu items without labels', () => {
      const items = [
        createMenuItem({ id: 'item1', label: 'Item One' }),
        createMenuItem({ id: 'item2', label: 'Item Two' }),
      ]
      
      render(<Menu items={items} isExpanded={false} />)
      
      // Labels should not be visible
      expect(screen.queryByText('Item One')).not.toBeInTheDocument()
      expect(screen.queryByText('Item Two')).not.toBeInTheDocument()
      
      // Should have 2 buttons
      expect(screen.getAllByRole('button')).toHaveLength(2)
    })

    it('renders icons when isExpanded=false', () => {
      const items = [
        createMenuItem({ icon: <span data-testid="icon-1">icon1</span> }),
      ]
      
      render(<Menu items={items} isExpanded={false} />)
      
      expect(screen.getByTestId('icon-1')).toBeInTheDocument()
    })

    it('does not show parent menu children when collapsed', () => {
      const childItem = createMenuItem({ id: 'child', label: 'Child Item' })
      const parentItem = createParentMenuItem([childItem], { label: 'Parent' })
      
      render(<Menu items={[parentItem]} isExpanded={false} />)
      
      expect(screen.queryByText('Child Item')).not.toBeInTheDocument()
    })
  })

  describe('when expanded (isExpanded=true)', () => {
    it('renders menu items with labels', () => {
      const items = [
        createMenuItem({ id: 'item1', label: 'Item One' }),
        createMenuItem({ id: 'item2', label: 'Item Two' }),
      ]
      
      render(<Menu items={items} isExpanded={true} />)
      
      expect(screen.getByText('Item One')).toBeInTheDocument()
      expect(screen.getByText('Item Two')).toBeInTheDocument()
    })

    it('calls onClick when menu item is clicked', () => {
      const onClick = vi.fn()
      const items = [createMenuItem({ onClick, label: 'Clickable Item' })]
      
      render(<Menu items={items} isExpanded={true} />)
      
      fireEvent.click(screen.getByRole('button', { name: /clickable item/i }))
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('applies active styling to active items', () => {
      const items = [
        createMenuItem({ id: 'active', label: 'Active Item', isActive: true }),
        createMenuItem({ id: 'inactive', label: 'Inactive Item', isActive: false }),
      ]
      
      const { container } = render(<Menu items={items} isExpanded={true} />)
      
      const buttons = container.querySelectorAll('button')
      const activeButton = buttons[0]
      const inactiveButton = buttons[1]
      
      expect(activeButton?.className).toContain('bg-[var(--color-navigation-menu-item-active)]')
      expect(inactiveButton?.className).not.toContain('bg-[var(--color-navigation-menu-item-active)]')
    })
  })

  describe('parent menu items', () => {
    it('renders parent menu item with chevron when expanded', () => {
      const childItem = createMenuItem({ id: 'child', label: 'Child Item' })
      const parentItem = createParentMenuItem([childItem], { label: 'Parent Item' })
      
      render(<Menu items={[parentItem]} isExpanded={true} />)
      
      expect(screen.getByText('Parent Item')).toBeInTheDocument()
      expect(screen.getByTestId('chevron-down')).toBeInTheDocument()
    })

    it('toggles children visibility when parent is clicked', () => {
      const childItem = createMenuItem({ id: 'child', label: 'Child Item' })
      const parentItem = createParentMenuItem([childItem], { 
        label: 'Parent Item',
        isActive: false 
      })
      
      render(<Menu items={[parentItem]} isExpanded={true} />)
      
      // Child should be hidden initially (isActive=false means closed)
      expect(screen.queryByText('Child Item')).not.toBeInTheDocument()
      
      // Click parent to open
      fireEvent.click(screen.getByRole('button', { name: /parent item/i }))
      
      // Child should now be visible
      expect(screen.getByText('Child Item')).toBeInTheDocument()
      
      // Click parent again to close
      fireEvent.click(screen.getByRole('button', { name: /parent item/i }))
      
      // Child should be hidden again
      expect(screen.queryByText('Child Item')).not.toBeInTheDocument()
    })

    it('shows children by default when parent isActive=true', () => {
      const childItem = createMenuItem({ id: 'child', label: 'Child Item' })
      const parentItem = createParentMenuItem([childItem], { 
        label: 'Parent Item',
        isActive: true 
      })
      
      render(<Menu items={[parentItem]} isExpanded={true} />)
      
      // Child should be visible initially
      expect(screen.getByText('Child Item')).toBeInTheDocument()
    })

    it('rotates chevron when parent is opened', () => {
      const childItem = createMenuItem({ id: 'child', label: 'Child Item' })
      const parentItem = createParentMenuItem([childItem], { 
        label: 'Parent Item',
        isActive: false 
      })
      
      render(<Menu items={[parentItem]} isExpanded={true} />)
      
      const chevron = screen.getByTestId('chevron-down')
      
      // Initially should not be rotated
      expect(chevron.className).not.toContain('rotate-180')
      
      // Click to open
      fireEvent.click(screen.getByRole('button', { name: /parent item/i }))
      
      // Should be rotated now
      expect(chevron.className).toContain('rotate-180')
    })

    it('renders nested children with proper indentation', () => {
      const childItem = createMenuItem({ id: 'child', label: 'Child Item' })
      const parentItem = createParentMenuItem([childItem], { 
        label: 'Parent Item',
        isActive: true 
      })
      
      const { container } = render(<Menu items={[parentItem]} isExpanded={true} />)
      
      // Check that children container has proper styling
      const childrenContainer = container.querySelector('.ml-4.mt-1')
      expect(childrenContainer).toBeInTheDocument()
      expect(childrenContainer?.className).toContain('border-l')
      expect(childrenContainer?.className).toContain('pl-3')
    })

    it('handles multiple children correctly', () => {
      const child1 = createMenuItem({ id: 'child1', label: 'Child One' })
      const child2 = createMenuItem({ id: 'child2', label: 'Child Two' })
      const parentItem = createParentMenuItem([child1, child2], { 
        label: 'Parent Item',
        isActive: true 
      })
      
      render(<Menu items={[parentItem]} isExpanded={true} />)
      
      expect(screen.getByText('Child One')).toBeInTheDocument()
      expect(screen.getByText('Child Two')).toBeInTheDocument()
    })

    it('calls child onClick when child item is clicked', () => {
      const childOnClick = vi.fn()
      const childItem = createMenuItem({ 
        id: 'child', 
        label: 'Child Item', 
        onClick: childOnClick 
      })
      const parentItem = createParentMenuItem([childItem], { 
        label: 'Parent Item',
        isActive: true 
      })
      
      render(<Menu items={[parentItem]} isExpanded={true} />)
      
      fireEvent.click(screen.getByRole('button', { name: /child item/i }))
      expect(childOnClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('menu item without icon', () => {
    it('renders properly when no icon is provided', () => {
      const items = [createMenuItem({ icon: undefined, label: 'No Icon Item' })]
      
      render(<Menu items={items} isExpanded={true} />)
      
      expect(screen.getByText('No Icon Item')).toBeInTheDocument()
    })
  })

  describe('complex menu structure', () => {
    it('renders mixed item types correctly', () => {
      const simpleItem = createMenuItem({ id: 'simple', label: 'Simple Item' })
      const childItem = createMenuItem({ id: 'child', label: 'Child Item' })
      const parentItem = createParentMenuItem([childItem], { 
        id: 'parent',
        label: 'Parent Item',
        isActive: true 
      })
      
      render(<Menu items={[simpleItem, parentItem]} isExpanded={true} />)
      
      expect(screen.getByText('Simple Item')).toBeInTheDocument()
      expect(screen.getByText('Parent Item')).toBeInTheDocument()
      expect(screen.getByText('Child Item')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('uses button elements for all menu items', () => {
      const childItem = createMenuItem({ id: 'child', label: 'Child Item' })
      const parentItem = createParentMenuItem([childItem], { 
        label: 'Parent Item',
        isActive: true 
      })
      
      render(<Menu items={[parentItem]} isExpanded={true} />)
      
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(2) // Parent and child
    })

    it('maintains proper button order for keyboard navigation', () => {
      const item1 = createMenuItem({ id: 'item1', label: 'First Item' })
      const item2 = createMenuItem({ id: 'item2', label: 'Second Item' })
      
      render(<Menu items={[item1, item2]} isExpanded={true} />)
      
      const buttons = screen.getAllByRole('button')
      expect(buttons[0]).toHaveTextContent('First Item')
      expect(buttons[1]).toHaveTextContent('Second Item')
    })
  })
})