import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  collectCodeSignPaths,
  collectSignablePaths,
  inferMacUpdaterArch,
  isMachOFile,
  writeMacAppUpdateConfig
} from '../../scripts/prepare-mac-signing.mjs';
import { shouldIgnoreMacSignPath } from '../../scripts/custom-mac-sign.mjs';

function writeBinaryFile(filePath: string, headerHex: string): void {
  const buffer = Buffer.concat([Buffer.from(headerHex, 'hex'), Buffer.alloc(8)]);
  writeFileSync(filePath, buffer);
}

describe('prepare-mac-signing', () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('detects Mach-O files by header magic', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'cosmo-macho-'));
    const machoPath = join(tempDir, 'Electron');
    const blobPath = join(tempDir, 'locale.pak');

    writeBinaryFile(machoPath, 'cffaedfe');
    writeBinaryFile(blobPath, '05000000');

    await expect(isMachOFile(machoPath)).resolves.toBe(true);
    await expect(isMachOFile(blobPath)).resolves.toBe(false);
  });

  it('collects only Mach-O files and code bundles for re-signing', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'cosmo-sign-targets-'));
    const frameworkDir = join(tempDir, 'Frameworks', 'Electron Framework.framework');
    const librariesDir = join(frameworkDir, 'Versions', 'A', 'Libraries');
    const resourcesDir = join(frameworkDir, 'Versions', 'A', 'Resources', 'tr.lproj');

    mkdirSync(librariesDir, { recursive: true });
    mkdirSync(resourcesDir, { recursive: true });

    const dylibPath = join(librariesDir, 'libEGL.dylib');
    const localePath = join(resourcesDir, 'locale.pak');

    writeBinaryFile(dylibPath, 'cffaedfe');
    writeBinaryFile(localePath, '05000000');

    const codeSignPaths = await collectCodeSignPaths(tempDir);

    expect(codeSignPaths).toContain(dylibPath);
    expect(codeSignPaths).toContain(frameworkDir);
    expect(codeSignPaths).not.toContain(localePath);
  });

  it('still strips inherited signatures from binary resource blobs before signing', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'cosmo-strip-targets-'));
    const resourcesDir = join(tempDir, 'Frameworks', 'Electron Framework.framework', 'Resources');

    mkdirSync(resourcesDir, { recursive: true });

    const localePath = join(resourcesDir, 'locale.pak');
    writeBinaryFile(localePath, '05000000');

    const signablePaths = await collectSignablePaths(tempDir);

    expect(signablePaths).toContain(localePath);
  });

  it('writes an arch-specific app-update.yml into the signed macOS bundle resources', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'cosmo-app-update-config-'));
    const appPath = join(tempDir, 'dist', 'mac-arm64', 'Cosmo Downloader.app');

    await writeMacAppUpdateConfig(appPath, inferMacUpdaterArch(appPath));

    const configPath = join(appPath, 'Contents', 'Resources', 'app-update.yml');
    const config = readFileSync(configPath, 'utf8');

    expect(config).toContain('provider: "generic"');
    expect(config).toContain('channel: "latest-arm64-mac"');
    expect(config).toContain('updaterCacheDirName: "cosmo-downloader-updater"');
  });

  it('ignores non-code blobs during the actual signing pass', () => {
    const appPath = '/tmp/Cosmo Downloader.app';
    const codePath = `${appPath}/Contents/Frameworks/Electron Framework.framework`;
    const localePath = `${appPath}/Contents/Frameworks/Electron Framework.framework/Resources/locale.pak`;
    const codeSignPaths = new Set([codePath]);

    expect(
      shouldIgnoreMacSignPath(localePath, {
        appPath,
        codeSignPaths,
        duplicateAliasPaths: new Set(),
        ignore: undefined
      })
    ).toBe(true);

    expect(
      shouldIgnoreMacSignPath(codePath, {
        appPath,
        codeSignPaths,
        duplicateAliasPaths: new Set(),
        ignore: undefined
      })
    ).toBe(false);
  });
});
