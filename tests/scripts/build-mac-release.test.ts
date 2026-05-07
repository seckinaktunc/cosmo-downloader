import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it, vi } from 'vitest';
import {
  getMacDirBuildInvocation,
  getMacPackageInvocation,
  getMacUpdateManifestName,
  runMacReleaseBuild
} from '../../scripts/build-mac-release.mjs';

describe('getMacDirBuildInvocation', () => {
  it('uses a --dir build for the requested architecture', () => {
    const invocation = getMacDirBuildInvocation('arm64');

    expect(invocation.command).toBe(process.execPath);
    expect(invocation.args).toEqual(
      expect.arrayContaining(['--mac', '--dir', '--arm64', '--publish', 'never'])
    );
  });
});

describe('getMacPackageInvocation', () => {
  it('packages dmg and zip from a prepackaged app', () => {
    const invocation = getMacPackageInvocation({
      arch: 'x64',
      appPath: '/tmp/Cosmo Downloader.app'
    });

    expect(invocation.args).toEqual(
      expect.arrayContaining([
        '--mac',
        'dmg',
        'zip',
        '--x64',
        '--publish',
        'never',
        '--prepackaged',
        '/tmp/Cosmo Downloader.app'
      ])
    );
  });
});

describe('runMacReleaseBuild', () => {
  it('builds, notarizes, packages, renames the manifest, and verifies the result', async () => {
    const distDir = mkdtempSync(join(tmpdir(), 'cosmo-mac-release-'));
    const appDir = join(distDir, 'mac-arm64');
    mkdirSync(appDir, { recursive: true });
    const appPath = join(appDir, 'Cosmo Downloader.app');
    writeFileSync(appPath, 'app');

    const commandRunner = vi.fn(async (_command, args) => {
      if (Array.isArray(args) && args.includes('--prepackaged')) {
        writeFileSync(join(distDir, 'latest-mac.yml'), 'version: 1.0.7');
      }
    });
    const notarizeApp = vi.fn(async () => {});
    const verifyPackage = vi.fn(async () => {});

    await runMacReleaseBuild({
      arch: 'arm64',
      distDir,
      env: {},
      platform: 'darwin',
      commandRunner,
      notarizeApp,
      verifyPackage
    });

    expect(commandRunner).toHaveBeenNthCalledWith(
      1,
      process.execPath,
      expect.arrayContaining(['--mac', '--dir', '--arm64', '--publish', 'never']),
      expect.any(Object)
    );
    expect(notarizeApp).toHaveBeenCalledWith(
      expect.objectContaining({
        appPath,
        platform: 'darwin'
      })
    );
    expect(commandRunner).toHaveBeenNthCalledWith(
      2,
      process.execPath,
      expect.arrayContaining(['dmg', 'zip', '--arm64', '--prepackaged', appPath]),
      expect.any(Object)
    );
    expect(verifyPackage).toHaveBeenCalledWith(
      expect.objectContaining({
        arch: 'arm64',
        distDir,
        platform: 'darwin'
      })
    );
    expect(getMacUpdateManifestName('arm64')).toBe('latest-arm64-mac.yml');
  });
});
