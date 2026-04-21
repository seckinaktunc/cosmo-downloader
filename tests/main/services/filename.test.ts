import { describe, expect, it } from 'vitest'
import { sanitizeFilename } from '@main/services/filename'

describe('sanitizeFilename', () => {
  it('replaces cross-platform illegal filesystem characters', () => {
    expect(sanitizeFilename('a<b>:c"d/e\\f|g?h*')).toBe('a b c d e f g h')
  })

  it('guards Windows reserved names', () => {
    expect(sanitizeFilename('CON')).toBe('_CON')
  })

  it('uses a fallback for empty output', () => {
    expect(sanitizeFilename('***', 'video')).toBe('video')
  })
})
