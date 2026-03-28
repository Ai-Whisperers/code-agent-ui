import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from './Input'

describe('Input', () => {
  it('renders with default styling', () => {
    render(<Input />)
    
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    
    // Check base classes are applied
    expect(input.className).toContain('px-2 py-1 text-xs rounded')
    expect(input.className).toContain('border-[var(--color-cards-card-stroke)]')
    expect(input.className).toContain('bg-[var(--color-cards-card-background)]')
    expect(input.className).toContain('text-[var(--color-fonts-font-color-primary)]')
  })

  it('applies hover and focus styles', () => {
    render(<Input />)
    
    const input = screen.getByRole('textbox')
    expect(input.className).toContain('hover:border-[var(--color-buttons-button-primary)]')
    expect(input.className).toContain('focus:border-[var(--color-buttons-button-primary)]')
    expect(input.className).toContain('focus:outline-none')
    expect(input.className).toContain('transition-all')
  })

  it('applies placeholder styling', () => {
    render(<Input />)
    
    const input = screen.getByRole('textbox')
    expect(input.className).toContain('placeholder:text-[var(--color-fonts-font-color-support)]')
  })

  it('handles custom className', () => {
    render(<Input className="custom-class" />)
    
    const input = screen.getByRole('textbox')
    expect(input.className).toContain('custom-class')
    
    // Should still include base classes
    expect(input.className).toContain('px-2 py-1')
    expect(input.className).toContain('rounded')
  })

  it('passes through HTML input attributes', () => {
    render(
      <Input
        type="email"
        placeholder="Enter email"
        value="test@example.com"
        data-testid="email-input"
        readOnly
      />
    )
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('placeholder', 'Enter email')
    expect(input).toHaveValue('test@example.com')
    expect(input).toHaveAttribute('data-testid', 'email-input')
    expect(input).toHaveAttribute('readonly')
  })

  it('handles onChange events', () => {
    const onChange = vi.fn()
    render(<Input onChange={onChange} />)
    
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'new value' } })
    
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({
          value: 'new value'
        })
      })
    )
  })

  it('handles onFocus and onBlur events', () => {
    const onFocus = vi.fn()
    const onBlur = vi.fn()
    render(<Input onFocus={onFocus} onBlur={onBlur} />)
    
    const input = screen.getByRole('textbox')
    
    fireEvent.focus(input)
    expect(onFocus).toHaveBeenCalledTimes(1)
    
    fireEvent.blur(input)
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it('supports different input types', () => {
    const { rerender } = render(<Input type="password" />)
    expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'password')
    
    rerender(<Input type="number" />)
    expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number')
    
    rerender(<Input type="email" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')
  })

  it('handles disabled state', () => {
    render(<Input disabled />)
    
    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
  })

  it('handles required attribute', () => {
    render(<Input required />)
    
    const input = screen.getByRole('textbox')
    expect(input).toBeRequired()
  })

  it('supports controlled input', () => {
    const { rerender } = render(<Input value="initial" onChange={vi.fn()} />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('initial')
    
    rerender(<Input value="updated" onChange={vi.fn()} />)
    expect(input).toHaveValue('updated')
  })

  it('supports uncontrolled input with defaultValue', () => {
    render(<Input defaultValue="default text" />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('default text')
  })

  it('handles maxLength attribute', () => {
    render(<Input maxLength={10} />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('maxLength', '10')
  })

  it('handles min and max for number inputs', () => {
    render(<Input type="number" min={0} max={100} />)
    
    const input = screen.getByRole('spinbutton')
    expect(input).toHaveAttribute('min', '0')
    expect(input).toHaveAttribute('max', '100')
  })

  it('handles pattern attribute', () => {
    render(<Input pattern="[0-9]*" />)
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('pattern', '[0-9]*')
  })

  describe('edge cases', () => {
    it('handles empty className gracefully', () => {
      render(<Input className="" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input.className).toContain('px-2 py-1') // base classes still applied
    })

    it('handles undefined className gracefully', () => {
      render(<Input className={undefined} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
    })

    it('handles onKeyDown events', () => {
      const onKeyDown = vi.fn()
      render(<Input onKeyDown={onKeyDown} />)
      
      const input = screen.getByRole('textbox')
      fireEvent.keyDown(input, { key: 'Enter' })
      
      expect(onKeyDown).toHaveBeenCalledTimes(1)
      expect(onKeyDown).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'Enter'
        })
      )
    })

    it('handles multiple class names in custom className', () => {
      render(<Input className="class1 class2 class3" />)
      
      const input = screen.getByRole('textbox')
      expect(input.className).toContain('class1')
      expect(input.className).toContain('class2')  
      expect(input.className).toContain('class3')
    })
  })
})