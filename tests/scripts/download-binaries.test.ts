import { describe, expect, it } from 'vitest';
import {
  getArchiveExtractionInvocation,
  isArchiveSignatureValid,
  resolveRequestedPlatforms
} from '../../scripts/download-binaries.mjs';

describe('isArchiveSignatureValid', () => {
  it('recognizes XZ and ZIP archive signatures', () => {
    expect(
      isArchiveSignatureValid('ffmpeg.tar.xz', Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]))
    ).toBe(true);
    expect(isArchiveSignatureValid('deno.zip', Buffer.from('504b0304', 'hex'))).toBe(true);
  });

  it('rejects HTML error responses saved as archives', () => {
    expect(isArchiveSignatureValid('ffmpeg.tar.xz', Buffer.from('<html>'))).toBe(false);
    expect(isArchiveSignatureValid('deno.zip', Buffer.from('<html>'))).toBe(false);
  });
});

describe('getArchiveExtractionInvocation', () => {
  it('uses PowerShell for zip extraction on Windows', () => {
    const invocation = getArchiveExtractionInvocation('C:\\tmp\\deno.zip', 'C:\\tmp\\out', 'win32');

    expect(invocation.command).toBe('powershell.exe');
    expect(invocation.args).toEqual(
      expect.arrayContaining([
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Expand-Archive -LiteralPath $env:COSMO_ARCHIVE_PATH -DestinationPath $env:COSMO_DEST_DIR -Force'
      ])
    );
    expect(invocation.errorTool).toBe('PowerShell Expand-Archive');
  });

  it('uses unzip for zip extraction on Linux', () => {
    const invocation = getArchiveExtractionInvocation('/tmp/deno.zip', '/tmp/out', 'linux');

    expect(invocation.command).toBe('unzip');
    expect(invocation.args).toEqual(['-q', '-o', '/tmp/deno.zip', '-d', '/tmp/out']);
    expect(invocation.errorTool).toBe('unzip');
  });

  it('uses tar for tarball extraction', () => {
    const invocation = getArchiveExtractionInvocation(
      '/tmp/ffmpeg-release-amd64-static.tar.xz',
      '/tmp/out',
      'linux'
    );

    expect(invocation.command).toBe('tar');
    expect(invocation.args).toEqual([
      '-xf',
      '/tmp/ffmpeg-release-amd64-static.tar.xz',
      '-C',
      '/tmp/out'
    ]);
    expect(invocation.errorTool).toBe('tar');
  });
});

describe('resolveRequestedPlatforms', () => {
  it('uses the current runtime platform by default', () => {
    expect(resolveRequestedPlatforms([])).toEqual([`${process.platform}-${process.arch}`]);
  });

  it('returns all known platform keys for --all', () => {
    expect(resolveRequestedPlatforms(['--all'])).toEqual(
      expect.arrayContaining(['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64'])
    );
  });

  it('supports repeated explicit --platform arguments', () => {
    expect(
      resolveRequestedPlatforms(['--platform', 'darwin-x64', '--platform', 'darwin-arm64'])
    ).toEqual(['darwin-x64', 'darwin-arm64']);
  });

  it('supports inline --platform=value arguments', () => {
    expect(resolveRequestedPlatforms(['--platform=darwin-arm64'])).toEqual(['darwin-arm64']);
  });
});
