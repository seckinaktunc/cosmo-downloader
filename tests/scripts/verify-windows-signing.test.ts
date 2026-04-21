import { describe, expect, it } from 'vitest'
import { evaluateSignature, verifyWindowsSigning } from '../../scripts/verify-windows-signing.mjs'

describe('evaluateSignature', () => {
  it('accepts valid Authenticode signatures only', () => {
    expect(evaluateSignature('Valid')).toBe(true)
    expect(evaluateSignature('NotSigned')).toBe(false)
    expect(evaluateSignature('HashMismatch')).toBe(false)
  })
})

describe('verifyWindowsSigning', () => {
  it('passes when every artifact has a valid signature', async () => {
    await expect(
      verifyWindowsSigning({
        getArtifacts: () => ['app.exe', 'setup.exe'],
        pathExists: () => true,
        readSignature: async () => ({ Status: 'Valid', StatusMessage: 'ok' })
      })
    ).resolves.toBeUndefined()
  })

  it('fails when an artifact is unsigned', async () => {
    await expect(
      verifyWindowsSigning({
        getArtifacts: () => ['app.exe'],
        pathExists: () => true,
        readSignature: async () => ({ Status: 'NotSigned', StatusMessage: 'missing signature' })
      })
    ).rejects.toThrow('NotSigned')
  })
})
