import { render, screen, fireEvent } from '@testing-library/react'
import { packageLineRate, GenerateTestsConfirmDialog } from './CoverageDetail'
import type { PackageLineCoverage } from '@/types/api'

// ── packageLineRate ────────────────────────────────────────────────────────────

describe('packageLineRate', () => {
  it('returns 0 when both covered and missed are 0', () => {
    expect(packageLineRate({ name: 'pkg', linesCovered: 0, linesMissed: 0 })).toBe(0)
  })

  it('returns 100 when all lines are covered', () => {
    expect(packageLineRate({ name: 'pkg', linesCovered: 50, linesMissed: 0 })).toBe(100)
  })

  it('returns 0 when no lines are covered', () => {
    expect(packageLineRate({ name: 'pkg', linesCovered: 0, linesMissed: 40 })).toBe(0)
  })

  it('returns correct percentage for mixed coverage', () => {
    expect(packageLineRate({ name: 'pkg', linesCovered: 3, linesMissed: 1 })).toBe(75)
  })

  it('rounds correctly for non-integer results', () => {
    const rate = packageLineRate({ name: 'pkg', linesCovered: 1, linesMissed: 2 })
    expect(rate).toBeCloseTo(33.33, 1)
  })
})

// ── GenerateTestsConfirmDialog helpers ────────────────────────────────────────

const DEFAULTS = {
  modelName: 'claude-sonnet',
  inputCostPerM: 3,
  outputCostPerM: 15,
  isPending: false,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
}

function makePkg(name: string, covered = 10, missed = 90): PackageLineCoverage {
  return { name, linesCovered: covered, linesMissed: missed }
}

function renderDialog(packages: PackageLineCoverage[], overrides = {}) {
  const props = { ...DEFAULTS, onConfirm: vi.fn(), onCancel: vi.fn(), ...overrides }
  render(<GenerateTestsConfirmDialog packages={packages} {...props} />)
  return props
}

// ── GenerateTestsConfirmDialog ─────────────────────────────────────────────────

describe('GenerateTestsConfirmDialog', () => {

  describe('single package', () => {
    it('renders the package name', () => {
      renderDialog([makePkg('com/example/Service')])
      expect(screen.getByText('com.example.Service')).toBeInTheDocument()
    })

    it('shows coverage rate badge', () => {
      renderDialog([makePkg('pkg', 10, 90)])
      expect(screen.getByText('10.0%')).toBeInTheDocument()
    })

    it('does NOT show batch size control for a single package', () => {
      renderDialog([makePkg('pkg')])
      expect(screen.queryByText('Packages per job')).not.toBeInTheDocument()
    })

    it('calls onCancel when Cancel is clicked', () => {
      const { onCancel } = renderDialog([makePkg('pkg')])
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('calls onConfirm with batchSize=1 and the single package', () => {
      const { onConfirm } = renderDialog([makePkg('pkg')])
      fireEvent.click(screen.getByRole('button', { name: /queue job/i }))
      expect(onConfirm).toHaveBeenCalledWith(1, [makePkg('pkg')])
    })
  })

  describe('multiple packages', () => {
    const pkgs = [makePkg('com/a', 0, 100), makePkg('com/b', 20, 80), makePkg('com/c', 50, 50)]

    it('renders all package names', () => {
      renderDialog(pkgs)
      expect(screen.getByText('com.a')).toBeInTheDocument()
      expect(screen.getByText('com.b')).toBeInTheDocument()
      expect(screen.getByText('com.c')).toBeInTheDocument()
    })

    it('shows batch size control for multiple packages', () => {
      renderDialog(pkgs)
      expect(screen.getByText('Packages per job')).toBeInTheDocument()
    })

    it('defaults batch size to min(3, count)', () => {
      renderDialog(pkgs) // 3 packages → batch=3
      const input = screen.getByRole('spinbutton') as HTMLInputElement
      expect(input.value).toBe('3')
    })

    it('defaults batch size to 3 when there are more than 3 packages', () => {
      const many = Array.from({ length: 6 }, (_, i) => makePkg(`pkg${i}`))
      renderDialog(many)
      const input = screen.getByRole('spinbutton') as HTMLInputElement
      expect(input.value).toBe('3')
    })

    it('shows queue button with job count', () => {
      const sixPkgs = Array.from({ length: 6 }, (_, i) => makePkg(`pkg${i}`))
      renderDialog(sixPkgs) // batch=3 → 2 jobs
      expect(screen.getByRole('button', { name: /queue 2 jobs/i })).toBeInTheDocument()
    })

    it('removing a package with X button decrements total', () => {
      renderDialog(pkgs)
      const removeButtons = screen.getAllByTitle('Remove this package')
      expect(removeButtons).toHaveLength(3)
      fireEvent.click(removeButtons[0])
      // After removal there are 2 packages
      expect(screen.getAllByTitle('Remove this package')).toHaveLength(2)
    })

    it('hides X buttons when only 1 package remains', () => {
      renderDialog([makePkg('a'), makePkg('b')])
      const btns = screen.getAllByTitle('Remove this package')
      fireEvent.click(btns[0]) // remove first → 1 left
      expect(screen.queryByTitle('Remove this package')).not.toBeInTheDocument()
    })

    it('calls onConfirm with remaining packages after removal', () => {
      const { onConfirm } = renderDialog(pkgs)
      fireEvent.click(screen.getAllByTitle('Remove this package')[0]) // remove 'com/a'
      fireEvent.click(screen.getByRole('button', { name: /queue/i }))
      const [, calledPkgs] = (onConfirm as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(calledPkgs).toHaveLength(2)
      expect(calledPkgs.map((p: PackageLineCoverage) => p.name)).not.toContain('com/a')
    })
  })

  describe('job removal', () => {
    it('shows Remove job button when jobCount > 1', () => {
      // 6 packages, batch=3 → 2 jobs; each job header should have a Remove job button
      const sixPkgs = Array.from({ length: 6 }, (_, i) => makePkg(`pkg${i}`))
      renderDialog(sixPkgs)
      const removeBtns = screen.getAllByTitle('Remove this entire job')
      expect(removeBtns.length).toBeGreaterThanOrEqual(1)
    })

    it('removes all packages in a job when Remove job is clicked', () => {
      const sixPkgs = Array.from({ length: 6 }, (_, i) => makePkg(`pkg${i}`))
      renderDialog(sixPkgs) // batch=3 → Job1:[0,1,2] Job2:[3,4,5]
      const removeBtns = screen.getAllByTitle('Remove this entire job')
      fireEvent.click(removeBtns[0]) // remove Job 1 (first 3 packages)
      // Total should be 3 remaining
      expect(screen.getAllByTitle('Remove this package')).toHaveLength(3)
      expect(screen.queryByText('pkg0'.replace(/\//g, '.'))).not.toBeInTheDocument()
    })

    it('does not show Remove job button when only one job', () => {
      const threePkgs = Array.from({ length: 3 }, (_, i) => makePkg(`pkg${i}`))
      renderDialog(threePkgs) // batch=3 → 1 job → no Remove job button
      expect(screen.queryByTitle('Remove this entire job')).not.toBeInTheDocument()
    })
  })

  describe('cost estimate', () => {
    it('shows estimated cost section', () => {
      renderDialog([makePkg('pkg')])
      expect(screen.getByText(/Estimated cost/i)).toBeInTheDocument()
    })

    it('shows model name in cost section', () => {
      renderDialog([makePkg('pkg')], { modelName: 'claude-haiku' })
      expect(screen.getByText(/claude-haiku/i)).toBeInTheDocument()
    })
  })

  describe('pending state', () => {
    it('disables Cancel and queue button when isPending=true', () => {
      renderDialog([makePkg('pkg')], { isPending: true })
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /queueing/i })).toBeDisabled()
    })

    it('shows "Queueing…" text on queue button when pending', () => {
      renderDialog([makePkg('pkg')], { isPending: true })
      expect(screen.getByRole('button', { name: /queueing/i })).toBeInTheDocument()
    })
  })
})
