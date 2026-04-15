import { describe, expect, it } from 'vitest'
import { getBrowserCandidates } from './browserDetector'

describe('getBrowserCandidates', () => {
  it('includes expected Windows yt-dlp cookie browser ids', () => {
    expect(getBrowserCandidates('win32').map((candidate) => candidate.id)).toEqual(
      expect.arrayContaining(['chrome', 'edge', 'firefox', 'brave'])
    )
  })

  it('includes Safari only on macOS', () => {
    expect(getBrowserCandidates('darwin').map((candidate) => candidate.id)).toContain('safari')
    expect(getBrowserCandidates('linux').map((candidate) => candidate.id)).not.toContain('safari')
  })
})
