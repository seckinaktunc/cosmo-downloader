import { describe, expect, it } from 'vitest'
import { detectCookieBrowsers, getBrowserCandidates } from '@main/services/browserDetector'

describe('getBrowserCandidates', () => {
  it('includes expected Windows yt-dlp cookie browser ids', () => {
    expect(getBrowserCandidates('win32').map((candidate) => candidate.id)).toEqual(
      expect.arrayContaining([
        'brave',
        'chrome',
        'chromium',
        'edge',
        'firefox',
        'opera',
        'vivaldi',
        'whale'
      ])
    )
  })

  it('checks common Windows Opera variants and Whale install paths', () => {
    const candidates = getBrowserCandidates('win32')
    const opera = candidates.find((candidate) => candidate.id === 'opera')
    const whale = candidates.find((candidate) => candidate.id === 'whale')

    expect(opera?.paths).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Opera GX'),
        expect.stringContaining('Opera beta'),
        expect.stringContaining('Opera developer')
      ])
    )
    expect(whale?.paths).toEqual(expect.arrayContaining([expect.stringContaining('Naver Whale')]))
  })

  it('includes Safari only on macOS', () => {
    expect(getBrowserCandidates('darwin').map((candidate) => candidate.id)).toContain('safari')
    expect(getBrowserCandidates('linux').map((candidate) => candidate.id)).not.toContain('safari')
  })
})

describe('detectCookieBrowsers', () => {
  it('returns only browsers with detected paths', () => {
    const browsers = detectCookieBrowsers('win32', (candidatePath) =>
      candidatePath.includes('Opera GX')
    )

    expect(browsers.map((browser) => browser.id)).toEqual(['none', 'opera'])
  })
})
