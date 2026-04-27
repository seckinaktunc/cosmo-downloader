/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const PROBE_PREFIX = 'cosmo-win-symlink-';

export class WindowsSymlinkPreflightError extends Error {
  constructor(cause) {
    super(
      [
        'Windows build preflight failed: this account cannot create symbolic links.',
        '',
        'Electron Builder needs symlink support while extracting its Windows signing/resource tools.',
        'Enable Windows Developer Mode, then close and reopen PowerShell.',
        '',
        'Settings > System > For developers > Developer Mode',
        '',
        'After enabling it, clear the broken Electron Builder cache:',
        'Remove-Item -LiteralPath "$env:LOCALAPPDATA\\electron-builder\\Cache\\winCodeSign" -Recurse -Force'
      ].join('\n')
    );
    this.name = 'WindowsSymlinkPreflightError';
    this.cause = cause;
  }
}

export function shouldRunWindowsSymlinkPreflight(platform = process.platform) {
  return platform === 'win32';
}

export function runWindowsSymlinkPreflight({
  platform = process.platform,
  makeTempDir = (prefix) => mkdtempSync(prefix),
  writeFile = writeFileSync,
  createSymlink = symlinkSync,
  removeDir = rmSync,
  getTempDir = tmpdir
} = {}) {
  if (!shouldRunWindowsSymlinkPreflight(platform)) {
    return { checked: false };
  }

  const probeDir = makeTempDir(join(getTempDir(), PROBE_PREFIX));
  try {
    const targetPath = join(probeDir, 'target.txt');
    const linkPath = join(probeDir, 'link.txt');
    writeFile(targetPath, 'probe');
    createSymlink(targetPath, linkPath);
    return { checked: true };
  } catch (error) {
    throw new WindowsSymlinkPreflightError(error);
  } finally {
    removeDir(probeDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  try {
    runWindowsSymlinkPreflight();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
