import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'events'
import {
  getLinuxSmokeTestArgs,
  getLinuxAppImageArtifactWithFs,
  verifyLinuxPackage
} from '../../scripts/verify-linux-package.mjs'

describe('getLinuxAppImageArtifactWithFs', () => {
  it('picks the newest AppImage artifact in the dist directory', () => {
    const artifact = getLinuxAppImageArtifactWithFs('dist', {
      readDir: () => ['cosmo-downloader-1.0.4.AppImage', 'cosmo-downloader-1.0.3.AppImage'],
      stat: (filePath) => ({
        mtimeMs: String(filePath).includes('1.0.4') ? 2 : 1
      })
    })

    expect(artifact).toContain('1.0.4.AppImage')
  })
})

describe('verifyLinuxPackage', () => {
  it('always adds --no-sandbox for the AppImage smoke test', () => {
    expect(getLinuxSmokeTestArgs('dist/cosmo.AppImage')).toEqual([
      '-a',
      'dist/cosmo.AppImage',
      '--no-sandbox'
    ])
  })

  it('passes when the packaged app exits cleanly', async () => {
    const child = new EventEmitter() as EventEmitter & { kill: ReturnType<typeof vi.fn> }
    child.kill = vi.fn()

    const spawnProcess = vi.fn(() => {
      queueMicrotask(() => child.emit('close', 0, null))
      return child
    })

    await expect(
      verifyLinuxPackage({
        platform: 'linux',
        getArtifact: () => 'dist/cosmo.AppImage',
        pathExists: () => true,
        spawnProcess,
        timeoutMs: 1000
      })
    ).resolves.toBeUndefined()

    expect(spawnProcess).toHaveBeenCalledWith(
      'xvfb-run',
      ['-a', 'dist/cosmo.AppImage', '--no-sandbox'],
      expect.objectContaining({
        env: expect.objectContaining({
          APPIMAGE_EXTRACT_AND_RUN: '1',
          COSMO_SMOKE_TEST: '1'
        })
      })
    )
  })

  it('fails when the packaged app exits unsuccessfully', async () => {
    const child = new EventEmitter() as EventEmitter & { kill: ReturnType<typeof vi.fn> }
    child.kill = vi.fn()

    const spawnProcess = vi.fn(() => {
      queueMicrotask(() => child.emit('close', 1, null))
      return child
    })

    await expect(
      verifyLinuxPackage({
        platform: 'linux',
        getArtifact: () => 'dist/cosmo.AppImage',
        pathExists: () => true,
        spawnProcess,
        timeoutMs: 1000
      })
    ).rejects.toThrow('code 1')
  })

  it('fails outside Linux', async () => {
    await expect(
      verifyLinuxPackage({
        platform: 'win32'
      })
    ).rejects.toThrow('must run on Linux')
  })
})
