import { describe, expect, it, vi } from 'vitest'
import {
  runWindowsSymlinkPreflight,
  shouldRunWindowsSymlinkPreflight,
  WindowsSymlinkPreflightError
} from '../../scripts/preflight-windows-symlink.mjs'

describe('shouldRunWindowsSymlinkPreflight', () => {
  it('runs only on Windows', () => {
    expect(shouldRunWindowsSymlinkPreflight('win32')).toBe(true)
    expect(shouldRunWindowsSymlinkPreflight('linux')).toBe(false)
    expect(shouldRunWindowsSymlinkPreflight('darwin')).toBe(false)
  })
})

describe('runWindowsSymlinkPreflight', () => {
  it('passes when symlink creation succeeds', () => {
    const createSymlink = vi.fn()
    const removeDir = vi.fn()

    expect(
      runWindowsSymlinkPreflight({
        platform: 'win32',
        makeTempDir: () => 'C:\\Temp\\cosmo-probe',
        writeFile: vi.fn(),
        createSymlink,
        removeDir,
        getTempDir: () => 'C:\\Temp'
      })
    ).toEqual({ checked: true })
    expect(createSymlink).toHaveBeenCalledWith(
      expect.stringContaining('target.txt'),
      expect.stringContaining('link.txt')
    )
    expect(removeDir).toHaveBeenCalledWith('C:\\Temp\\cosmo-probe', {
      recursive: true,
      force: true
    })
  })

  it('fails with a Developer Mode message when symlink creation is denied', () => {
    expect(() =>
      runWindowsSymlinkPreflight({
        platform: 'win32',
        makeTempDir: () => 'C:\\Temp\\cosmo-probe',
        writeFile: vi.fn(),
        createSymlink: () => {
          const error = new Error('privilege not held')
          Object.assign(error, { code: 'EPERM' })
          throw error
        },
        removeDir: vi.fn(),
        getTempDir: () => 'C:\\Temp'
      })
    ).toThrow(WindowsSymlinkPreflightError)

    expect(() =>
      runWindowsSymlinkPreflight({
        platform: 'win32',
        makeTempDir: () => 'C:\\Temp\\cosmo-probe',
        writeFile: vi.fn(),
        createSymlink: () => {
          throw new Error('privilege not held')
        },
        removeDir: vi.fn(),
        getTempDir: () => 'C:\\Temp'
      })
    ).toThrow('Enable Windows Developer Mode')
  })

  it('no-ops on non-Windows platforms', () => {
    const createSymlink = vi.fn()

    expect(
      runWindowsSymlinkPreflight({
        platform: 'linux',
        createSymlink
      })
    ).toEqual({ checked: false })
    expect(createSymlink).not.toHaveBeenCalled()
  })
})
