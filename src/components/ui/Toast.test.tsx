import { render, screen, fireEvent, act } from '@testing-library/react'
import { Toast } from './Toast'

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the message', () => {
    render(<Toast message="Something went wrong" onClose={vi.fn()} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('has role="alert" for accessibility', () => {
    render(<Toast message="Hello" onClose={vi.fn()} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('calls onClose when dismiss button is clicked', () => {
    const onClose = vi.fn()
    render(<Toast message="Hi" onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders action button when action prop is provided', () => {
    const onClick = vi.fn()
    render(
      <Toast
        message="Job done"
        action={{ label: 'View job', onClick }}
        onClose={vi.fn()}
      />,
    )
    const btn = screen.getByText(/View job/)
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not render action button when no action prop', () => {
    render(<Toast message="No action" onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /view/i })).not.toBeInTheDocument()
  })

  it('auto-dismisses after the specified duration', () => {
    const onClose = vi.fn()
    render(<Toast message="Auto" duration={3000} onClose={onClose} />)
    expect(onClose).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(3000))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not auto-dismiss when duration is 0', () => {
    const onClose = vi.fn()
    render(<Toast message="Sticky" duration={0} onClose={onClose} />)
    act(() => vi.advanceTimersByTime(60_000))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('defaults to auto-dismiss after 5000ms', () => {
    const onClose = vi.fn()
    render(<Toast message="Default" onClose={onClose} />)
    act(() => vi.advanceTimersByTime(4999))
    expect(onClose).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
