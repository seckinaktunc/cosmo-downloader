import { describe, expect, it } from 'vitest';
import { getArchiveExtractionInvocation } from '../../scripts/download-binaries.mjs';

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
