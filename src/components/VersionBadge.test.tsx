import { render, screen } from '@testing-library/react'
import { VersionBadge } from './VersionBadge'
import { vi } from 'vitest'
import type { LatestVersionsResponse } from '@/types/api'

// Mock the version utility
vi.mock('@/lib/version', () => ({
  getVersionStatus: vi.fn(),
}))

import { getVersionStatus } from '@/lib/version'

const mockGetVersionStatus = getVersionStatus as ReturnType<typeof vi.fn>

describe('VersionBadge', () => {
  beforeEach(() => {
    mockGetVersionStatus.mockReset()
  })

  it('renders dash when no version is provided', () => {
    render(<VersionBadge />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders version text when version is provided but no archetype', () => {
    render(<VersionBadge version="1.2.3" />)
    expect(screen.getByText('1.2.3')).toBeInTheDocument()
  })

  it('renders version text when version and archetype are provided but no latestVersions', () => {
    render(<VersionBadge version="1.2.3" archetype="spring-boot" />)
    expect(screen.getByText('1.2.3')).toBeInTheDocument()
  })

  it('renders version text when archetype is provided but latestVersions does not contain it', () => {
    const latestVersions: LatestVersionsResponse = {
      'other-archetype': '2.0.0'
    }
    render(<VersionBadge version="1.2.3" archetype="spring-boot" latestVersions={latestVersions} />)
    expect(screen.getByText('1.2.3')).toBeInTheDocument()
  })

  it('renders badge with up-to-date styling when version is current', () => {
    mockGetVersionStatus.mockReturnValue('up-to-date')
    const latestVersions: LatestVersionsResponse = {
      'spring-boot': '2.0.0'
    }
    
    const { container } = render(
      <VersionBadge version="2.0.0" archetype="spring-boot" latestVersions={latestVersions} />
    )
    
    expect(screen.getByText('2.0.0')).toBeInTheDocument()
    expect(mockGetVersionStatus).toHaveBeenCalledWith('2.0.0', '2.0.0')
    
    const badge = container.querySelector('span span')
    expect(badge?.className).toContain('bg-[var(--color-tags-success-background)]')
    expect(badge?.className).toContain('text-[var(--color-tags-font-success)]')
  })

  it('renders badge with warning styling when version has warning status', () => {
    mockGetVersionStatus.mockReturnValue('warning')
    const latestVersions: LatestVersionsResponse = {
      'spring-boot': '2.1.0'
    }
    
    const { container } = render(
      <VersionBadge version="2.0.0" archetype="spring-boot" latestVersions={latestVersions} />
    )
    
    expect(screen.getByText('2.0.0')).toBeInTheDocument()
    expect(mockGetVersionStatus).toHaveBeenCalledWith('2.0.0', '2.1.0')
    
    const badge = container.querySelector('span span')
    expect(badge?.className).toContain('bg-[var(--color-tags-attention-background)]')
    expect(badge?.className).toContain('text-[var(--color-tags-font-attention)]')
  })

  it('renders badge with critical styling when version has critical status', () => {
    mockGetVersionStatus.mockReturnValue('critical')
    const latestVersions: LatestVersionsResponse = {
      'spring-boot': '3.0.0'
    }
    
    const { container } = render(
      <VersionBadge version="2.0.0" archetype="spring-boot" latestVersions={latestVersions} />
    )
    
    expect(screen.getByText('2.0.0')).toBeInTheDocument()
    expect(mockGetVersionStatus).toHaveBeenCalledWith('2.0.0', '3.0.0')
    
    const badge = container.querySelector('span span')
    expect(badge?.className).toContain('bg-[var(--color-tags-critical-background)]')
    expect(badge?.className).toContain('text-[var(--color-tags-font-critical)]')
  })

  it('shows tooltip with latest version when version is outdated', () => {
    mockGetVersionStatus.mockReturnValue('warning')
    const latestVersions: LatestVersionsResponse = {
      'spring-boot': '2.1.0'
    }
    
    render(<VersionBadge version="2.0.0" archetype="spring-boot" latestVersions={latestVersions} />)
    
    expect(screen.getByText('Latest: 2.1.0')).toBeInTheDocument()
  })

  it('shows tooltip with latest version when version is critically outdated', () => {
    mockGetVersionStatus.mockReturnValue('critical')
    const latestVersions: LatestVersionsResponse = {
      'spring-boot': '3.0.0'
    }
    
    render(<VersionBadge version="2.0.0" archetype="spring-boot" latestVersions={latestVersions} />)
    
    expect(screen.getByText('Latest: 3.0.0')).toBeInTheDocument()
  })

  it('does not show tooltip when version is up-to-date', () => {
    mockGetVersionStatus.mockReturnValue('up-to-date')
    const latestVersions: LatestVersionsResponse = {
      'spring-boot': '2.0.0'
    }
    
    render(<VersionBadge version="2.0.0" archetype="spring-boot" latestVersions={latestVersions} />)
    
    expect(screen.queryByText(/Latest:/)).not.toBeInTheDocument()
  })

  it('handles undefined archetype gracefully', () => {
    const latestVersions: LatestVersionsResponse = {
      'spring-boot': '2.0.0'
    }
    
    render(<VersionBadge version="1.2.3" archetype={undefined} latestVersions={latestVersions} />)
    
    expect(screen.getByText('1.2.3')).toBeInTheDocument()
    expect(mockGetVersionStatus).not.toHaveBeenCalled()
  })

  it('handles undefined latestVersions gracefully', () => {
    render(<VersionBadge version="1.2.3" archetype="spring-boot" latestVersions={undefined} />)
    
    expect(screen.getByText('1.2.3')).toBeInTheDocument()
    expect(mockGetVersionStatus).not.toHaveBeenCalled()
  })

  it('handles empty string version', () => {
    render(<VersionBadge version="" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})