import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Loader2: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="loader" data-size={size} className={className} />
  ),
}))

describe('Button', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Click me')
  })

  it('applies default variant and size classes', () => {
    render(<Button>Default Button</Button>)
    
    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-[var(--color-buttons-button-back)]') // secondary variant
    expect(button.className).toContain('px-3 py-1.5 text-xs gap-1.5') // md size
  })

  describe('variants', () => {
    it('applies primary variant classes', () => {
      render(<Button variant="primary">Primary</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toContain('bg-[var(--color-buttons-button-primary)]')
      expect(button.className).toContain('text-white')
      expect(button.className).toContain('hover:bg-[var(--color-buttons-button-primary-hover)]')
    })

    it('applies secondary variant classes', () => {
      render(<Button variant="secondary">Secondary</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toContain('bg-[var(--color-buttons-button-back)]')
      expect(button.className).toContain('text-[var(--color-fonts-font-color-buttons)]')
      expect(button.className).toContain('hover:bg-[var(--color-buttons-button-back-hover)]')
    })

    it('applies ghost variant classes', () => {
      render(<Button variant="ghost">Ghost</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toContain('bg-transparent')
      expect(button.className).toContain('text-[var(--color-fonts-font-color-support)]')
      expect(button.className).toContain('hover:text-[var(--color-fonts-font-color-primary)]')
    })

    it('applies danger variant classes', () => {
      render(<Button variant="danger">Danger</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toContain('bg-[var(--color-tags-critical-background)]')
      expect(button.className).toContain('text-[var(--color-tags-font-critical)]')
      expect(button.className).toContain('hover:opacity-80')
    })

    it('applies success variant classes', () => {
      render(<Button variant="success">Success</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toContain('text-[var(--color-tags-font-success)]')
      expect(button.className).toContain('hover:bg-[var(--color-tags-success-background)]')
    })

    it('applies ai variant classes', () => {
      render(<Button variant="ai">AI</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toContain('bg-violet-50')
      expect(button.className).toContain('text-violet-700')
      expect(button.className).toContain('border-violet-200')
    })
  })

  describe('sizes', () => {
    it('applies xs size classes', () => {
      render(<Button size="xs">XS Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toContain('px-2 py-1 text-[11px] gap-1')
    })

    it('applies sm size classes', () => {
      render(<Button size="sm">SM Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toContain('px-2.5 py-1 text-xs gap-1')
    })

    it('applies md size classes', () => {
      render(<Button size="md">MD Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toContain('px-3 py-1.5 text-xs gap-1.5')
    })

    it('applies lg size classes', () => {
      render(<Button size="lg">LG Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toContain('px-4 py-2 text-sm gap-2')
    })
  })

  describe('loading state', () => {
    it('shows loader when loading=true', () => {
      render(<Button loading>Loading Button</Button>)
      
      expect(screen.getByTestId('loader')).toBeInTheDocument()
      expect(screen.getByText('Loading Button')).toBeInTheDocument()
    })

    it('disables button when loading=true', () => {
      render(<Button loading>Loading Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('uses correct loader size for lg buttons', () => {
      render(<Button loading size="lg">Loading</Button>)
      
      const loader = screen.getByTestId('loader')
      expect(loader).toHaveAttribute('data-size', '14')
    })

    it('uses correct loader size for non-lg buttons', () => {
      render(<Button loading size="md">Loading</Button>)
      
      const loader = screen.getByTestId('loader')
      expect(loader).toHaveAttribute('data-size', '11')
    })

    it('applies animation classes to loader', () => {
      render(<Button loading>Loading</Button>)
      
      const loader = screen.getByTestId('loader')
      expect(loader.className).toContain('animate-spin')
      expect(loader.className).toContain('shrink-0')
    })

    it('hides icon when loading', () => {
      const icon = <span data-testid="custom-icon">🔥</span>
      render(<Button loading icon={icon}>Loading</Button>)
      
      expect(screen.queryByTestId('custom-icon')).not.toBeInTheDocument()
      expect(screen.getByTestId('loader')).toBeInTheDocument()
    })
  })

  describe('icon', () => {
    it('renders icon when provided', () => {
      const icon = <span data-testid="custom-icon">🔥</span>
      render(<Button icon={icon}>With Icon</Button>)
      
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
      expect(screen.getByText('With Icon')).toBeInTheDocument()
    })

    it('applies shrink-0 class to icon wrapper', () => {
      const icon = <span data-testid="custom-icon">🔥</span>
      const { container } = render(<Button icon={icon}>With Icon</Button>)
      
      const iconWrapper = container.querySelector('span.shrink-0')
      expect(iconWrapper).toBeInTheDocument()
    })

    it('does not render icon wrapper when icon is not provided', () => {
      const { container } = render(<Button>No Icon</Button>)
      
      const iconWrapper = container.querySelector('span.shrink-0')
      expect(iconWrapper).not.toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('disables button when disabled=true', () => {
      render(<Button disabled>Disabled Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('applies disabled classes', () => {
      render(<Button disabled>Disabled Button</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toContain('disabled:opacity-50')
      expect(button.className).toContain('disabled:cursor-not-allowed')
    })

    it('is disabled when both disabled and loading are true', () => {
      render(<Button disabled loading>Disabled Loading</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })
  })

  describe('click handling', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn()
      render(<Button onClick={onClick}>Click me</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', () => {
      const onClick = vi.fn()
      render(<Button onClick={onClick} disabled>Disabled</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
    })

    it('does not call onClick when loading', () => {
      const onClick = vi.fn()
      render(<Button onClick={onClick} loading>Loading</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('custom props', () => {
    it('passes through custom className', () => {
      render(<Button className="custom-class">Custom</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toContain('custom-class')
    })

    it('passes through other HTML attributes', () => {
      render(<Button type="submit" data-testid="custom-button">Submit</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('type', 'submit')
      expect(button).toHaveAttribute('data-testid', 'custom-button')
    })

    it('applies base classes along with custom className', () => {
      render(<Button className="custom-class">Custom</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toContain('inline-flex')
      expect(button.className).toContain('items-center')
      expect(button.className).toContain('font-medium')
      expect(button.className).toContain('rounded')
      expect(button.className).toContain('transition-colors')
      expect(button.className).toContain('custom-class')
    })
  })

  describe('edge cases', () => {
    it('renders with empty children', () => {
      render(<Button></Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('handles null icon gracefully', () => {
      render(<Button icon={null}>Null Icon</Button>)
      
      expect(screen.getByText('Null Icon')).toBeInTheDocument()
    })

    it('handles undefined icon gracefully', () => {
      render(<Button icon={undefined}>Undefined Icon</Button>)
      
      expect(screen.getByText('Undefined Icon')).toBeInTheDocument()
    })
  })
})