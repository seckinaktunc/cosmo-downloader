import { describe, expect, it } from 'vitest'
import {
  extractReleaseNotes,
  normalizeReleaseVersion
} from '../../scripts/extract-release-notes.mjs'

const changelog = `# Changelog

## v1.0.5

### Fixed

- Later fix.

## v1.0.4

### Added

- Release note one.
- Release note two.

## v1.0.3

### Changed

- Older note.
`

describe('normalizeReleaseVersion', () => {
  it('supports tags with and without a v prefix', () => {
    expect(normalizeReleaseVersion('v1.0.4')).toBe('v1.0.4')
    expect(normalizeReleaseVersion('1.0.4')).toBe('v1.0.4')
    expect(normalizeReleaseVersion('refs/tags/v1.0.4')).toBe('v1.0.4')
  })
})

describe('extractReleaseNotes', () => {
  it('extracts the matching version section only', () => {
    expect(extractReleaseNotes(changelog, 'v1.0.4')).toBe(
      ['### Added', '', '- Release note one.', '- Release note two.'].join('\n')
    )
  })

  it('ignores other versions', () => {
    const notes = extractReleaseNotes(changelog, 'v1.0.4')

    expect(notes).not.toContain('Later fix')
    expect(notes).not.toContain('Older note')
  })

  it('throws when the matching version is missing', () => {
    expect(() => extractReleaseNotes(changelog, 'v9.9.9')).toThrow('No changelog section found')
  })

  it('throws when the matching section is empty', () => {
    expect(() => extractReleaseNotes('# Changelog\n\n## v1.0.4\n\n## v1.0.3\n\n- Old', 'v1.0.4')).toThrow(
      'empty'
    )
  })
})
