import { render, screen } from '@testing-library/react'
import { ReadinessBadge } from './ReadinessBadge'

describe('ReadinessBadge', () => {
  it('renders a dash when no label or score is provided', () => {
    render(<ReadinessBadge />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders "Poor" for label=poor', () => {
    render(<ReadinessBadge label="poor" />)
    expect(screen.getByText('Poor')).toBeInTheDocument()
  })

  it('renders "Needs Refinement" for label=needs_refinement', () => {
    render(<ReadinessBadge label="needs_refinement" />)
    expect(screen.getByText('Needs Refinement')).toBeInTheDocument()
  })

  it('renders "Minor Improvements" for label=ready_with_minor_improvements', () => {
    render(<ReadinessBadge label="ready_with_minor_improvements" />)
    expect(screen.getByText('Minor Improvements')).toBeInTheDocument()
  })

  it('renders "Fully Ready" for label=fully_ready', () => {
    render(<ReadinessBadge label="fully_ready" />)
    expect(screen.getByText('Fully Ready')).toBeInTheDocument()
  })

  it('renders unknown label as-is when score is also provided', () => {
    render(<ReadinessBadge label="custom_label" score={50} />)
    expect(screen.getByText('custom_label')).toBeInTheDocument()
  })

  it('renders dash when unknown label is provided but score is absent', () => {
    render(<ReadinessBadge label="custom_label" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows score when showScore=true and score is provided', () => {
    render(<ReadinessBadge label="fully_ready" score={85} showScore />)
    expect(screen.getByText('(85)')).toBeInTheDocument()
  })

  it('does not show score when showScore is false (default)', () => {
    render(<ReadinessBadge label="fully_ready" score={85} />)
    expect(screen.queryByText('(85)')).not.toBeInTheDocument()
  })

  it('renders score-only badge with neutral class when no label provided but score is set', () => {
    render(<ReadinessBadge score={50} showScore />)
    expect(screen.getByText('(50)')).toBeInTheDocument()
  })

  it('applies critical background class for "poor" label', () => {
    const { container } = render(<ReadinessBadge label="poor" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('critical')
  })

  it('applies success background class for "fully_ready" label', () => {
    const { container } = render(<ReadinessBadge label="fully_ready" />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('success')
  })
})
