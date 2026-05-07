import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  getCodesignVerifyArgs,
  getMacAppArtifactWithFs,
  getMacDmgArtifactWithFs,
  getMacZipArtifactWithFs,
  getSpctlAssessArgs,
  getStaplerValidateArgs,
  verifyMacPackage
} from '../../scripts/verify-mac-package.mjs';

describe('getMacAppArtifactWithFs', () => {
  it('prefers arch-specific app directories when present', () => {
    const artifact = getMacAppArtifactWithFs('dist', 'arm64', {
      readDir: (dir) => {
        if (String(dir).endsWith('mac-arm64')) {
          return ['Cosmo Downloader.app'];
        }
        throw new Error('missing');
      },
      stat: () => ({ mtimeMs: 1 })
    });

    expect(artifact).toContain('mac-arm64');
    expect(artifact).toContain('Cosmo Downloader.app');
  });
});

describe('getMacDmgArtifactWithFs', () => {
  it('picks the newest dmg matching the requested arch token', () => {
    const artifact = getMacDmgArtifactWithFs('dist', 'arm64', {
      readDir: () => [
        'cosmo-downloader-1.0.5-mac-arm64.dmg',
        'cosmo-downloader-1.0.4-mac-arm64.dmg'
      ],
      stat: (filePath) => ({
        mtimeMs: String(filePath).includes('1.0.5') ? 2 : 1
      })
    });

    expect(artifact).toContain('1.0.5-mac-arm64.dmg');
  });
});

describe('getMacZipArtifactWithFs', () => {
  it('ignores blockmaps when selecting the packaged zip', () => {
    const artifact = getMacZipArtifactWithFs('dist', 'universal', {
      readDir: () => [
        'cosmo-downloader-1.0.5-mac-universal.zip.blockmap',
        'cosmo-downloader-1.0.5-mac-universal.zip'
      ],
      stat: () => ({ mtimeMs: 1 })
    });

    expect(artifact).toContain('mac-universal.zip');
    expect(artifact).not.toContain('.blockmap');
  });
});

describe('verifyMacPackage', () => {
  it('runs codesign, spctl, and stapler checks for a native package', async () => {
    const child = new EventEmitter() as EventEmitter & { kill: ReturnType<typeof vi.fn> };
    child.kill = vi.fn();

    const spawnProcess = vi.fn(() => {
      queueMicrotask(() => child.emit('close', 0, null));
      return child;
    });

    await expect(
      verifyMacPackage({
        platform: 'darwin',
        arch: 'arm64',
        getAppArtifact: () => 'dist/mac-arm64/Cosmo Downloader.app',
        getDmgArtifact: () => 'dist/cosmo-downloader-1.0.6-mac-arm64.dmg',
        getZipArtifact: () => 'dist/cosmo-downloader-1.0.6-mac-arm64.zip',
        pathExists: () => true,
        spawnProcess,
        timeoutMs: 1000
      })
    ).resolves.toBeUndefined();

    expect(spawnProcess).toHaveBeenNthCalledWith(
      1,
      'codesign',
      getCodesignVerifyArgs('dist/mac-arm64/Cosmo Downloader.app'),
      expect.any(Object)
    );
    expect(spawnProcess).toHaveBeenNthCalledWith(
      2,
      'spctl',
      getSpctlAssessArgs('dist/mac-arm64/Cosmo Downloader.app'),
      expect.any(Object)
    );
    expect(spawnProcess).toHaveBeenNthCalledWith(
      3,
      'xcrun',
      getStaplerValidateArgs('dist/mac-arm64/Cosmo Downloader.app'),
      expect.any(Object)
    );
    expect(spawnProcess).toHaveBeenNthCalledWith(
      4,
      'xcrun',
      getStaplerValidateArgs('dist/cosmo-downloader-1.0.6-mac-arm64.dmg'),
      expect.any(Object)
    );
  });

  it('allows zip-only verification for universal update packages', async () => {
    const child = new EventEmitter() as EventEmitter & { kill: ReturnType<typeof vi.fn> };
    child.kill = vi.fn();

    const spawnProcess = vi.fn(() => {
      queueMicrotask(() => child.emit('close', 0, null));
      return child;
    });

    await expect(
      verifyMacPackage({
        platform: 'darwin',
        arch: 'universal',
        requireDmg: false,
        getAppArtifact: () => 'dist/mac-universal/Cosmo Downloader.app',
        getZipArtifact: () => 'dist/cosmo-downloader-1.0.6-mac-universal.zip',
        pathExists: () => true,
        spawnProcess,
        timeoutMs: 1000
      })
    ).resolves.toBeUndefined();

    expect(spawnProcess).toHaveBeenCalledTimes(3);
  });

  it('fails outside macOS', async () => {
    await expect(
      verifyMacPackage({
        platform: 'linux'
      })
    ).rejects.toThrow('must run on macOS');
  });
});
