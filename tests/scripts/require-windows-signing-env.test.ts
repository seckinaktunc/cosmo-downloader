import { describe, expect, it } from 'vitest'
import { getMissingWindowsSigningEnv } from '../../scripts/require-windows-signing-env.mjs'

describe('getMissingWindowsSigningEnv', () => {
  it('returns missing Windows signing variables', () => {
    expect(getMissingWindowsSigningEnv({ WIN_CSC_LINK: 'cert' })).toEqual(['WIN_CSC_KEY_PASSWORD'])
  })

  it('returns an empty list when all Windows signing variables exist', () => {
    expect(
      getMissingWindowsSigningEnv({
        WIN_CSC_LINK: 'cert',
        WIN_CSC_KEY_PASSWORD: 'password'
      })
    ).toEqual([])
  })
})
