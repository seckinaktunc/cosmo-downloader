import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  getCodesignVerifyArgs,
  getMacAppArtifactWithFs,
  getMacDmgArtifactWithFs,
  getMacUpdateManifestName,
  getMacUpdateManifestWithFs,
  getMacZipBlockmapArtifactWithFs,
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
    const artifact = getMacZipArtifactWithFs('dist', 'arm64', {
      readDir: () => [
        'cosmo-downloader-1.0.5-mac-arm64.zip.blockmap',
        'cosmo-downloader-1.0.5-mac-arm64.zip'
      ],
      stat: () => ({ mtimeMs: 1 })
    });

    expect(artifact).toContain('mac-arm64.zip');
    expect(artifact).not.toContain('.blockmap');
  });
});

describe('getMacZipBlockmapArtifactWithFs', () => {
  it('finds the matching zip blockmap for the requested architecture', () => {
    const artifact = getMacZipBlockmapArtifactWithFs('dist', 'arm64', {
      readDir: () => ['cosmo-downloader-1.0.5-mac-arm64.zip.blockmap'],
      stat: () => ({ mtimeMs: 1 })
    });

    expect(artifact).toContain('mac-arm64.zip.blockmap');
  });
});

describe('getMacUpdateManifestWithFs', () => {
  it('finds the arch-specific mac update manifest', () => {
    const artifact = getMacUpdateManifestWithFs('dist', 'x64', {
      readDir: () => ['latest-x64-mac.yml']
    });

    expect(getMacUpdateManifestName('x64')).toBe('latest-x64-mac.yml');
    expect(artifact).toContain('latest-x64-mac.yml');
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
        getZipBlockmapArtifact: () => 'dist/cosmo-downloader-1.0.6-mac-arm64.zip.blockmap',
        getManifestArtifact: () => 'dist/latest-arm64-mac.yml',
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
    expect(spawnProcess).toHaveBeenCalledTimes(3);
  });

  it('requires the arch-specific updater manifest and blockmap to exist', async () => {
    await expect(
      verifyMacPackage({
        platform: 'darwin',
        arch: 'x64',
        getAppArtifact: () => 'dist/mac/Cosmo Downloader.app',
        getDmgArtifact: () => 'dist/cosmo-downloader-1.0.6-mac-x64.dmg',
        getZipArtifact: () => 'dist/cosmo-downloader-1.0.6-mac-x64.zip',
        getZipBlockmapArtifact: () => undefined,
        getManifestArtifact: () => undefined,
        pathExists: () => true
      })
    ).rejects.toThrow('No macOS ZIP blockmap found');
  });

  it('fails outside macOS', async () => {
    await expect(
      verifyMacPackage({
        platform: 'linux'
      })
    ).rejects.toThrow('must run on macOS');
  });
});
