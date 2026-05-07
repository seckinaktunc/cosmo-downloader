import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getElectronBuilderInvocation,
  getLocalMacBuildEnv,
  getMissingMacNotarizationEnv,
  getNpmInvocation,
  parseEnvFile
} from '../../scripts/build-mac-local.mjs';

describe('parseEnvFile', () => {
  it('parses dotenv-style lines and strips surrounding quotes', () => {
    expect(
      parseEnvFile(`
# comment
APPLE_ID="user@example.com"
APPLE_TEAM_ID=TEAMID1234
CSC_NAME='Developer ID Application: Name (TEAMID1234)'
      `)
    ).toEqual({
      APPLE_ID: 'user@example.com',
      APPLE_TEAM_ID: 'TEAMID1234',
      CSC_NAME: 'Developer ID Application: Name (TEAMID1234)'
    });
  });
});

describe('getLocalMacBuildEnv', () => {
  it('fills missing values from the local env file without overriding shell env vars', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'cosmo-mac-env-'));
    const envFilePath = join(tempDir, '.env.mac.local');
    writeFileSync(
      envFilePath,
      ['APPLE_ID=file@example.com', 'APPLE_TEAM_ID=TEAMID1234', 'CSC_NAME=Developer ID'].join('\n')
    );

    const env = getLocalMacBuildEnv(
      {
        APPLE_ID: 'shell@example.com',
        PATH: 'bin'
      },
      envFilePath
    );

    expect(env.APPLE_ID).toBe('shell@example.com');
    expect(env.APPLE_TEAM_ID).toBe('TEAMID1234');
    expect(env.CSC_NAME).toBe('Developer ID');
    expect(env.PATH).toBe('bin');

    rmSync(tempDir, { recursive: true, force: true });
  });

  it('prefers existing shell env vars over file values', () => {
    const env = getLocalMacBuildEnv(
      {
        APPLE_ID: 'shell@example.com',
        PATH: 'bin'
      },
      '/tmp/does-not-exist'
    );

    expect(env.APPLE_ID).toBe('shell@example.com');
    expect(env.PATH).toBe('bin');
  });
});

describe('getMissingMacNotarizationEnv', () => {
  it('returns all required keys that are not set', () => {
    expect(getMissingMacNotarizationEnv({ APPLE_ID: 'user@example.com' })).toEqual([
      'APPLE_APP_SPECIFIC_PASSWORD',
      'APPLE_TEAM_ID'
    ]);
  });

  it('returns an empty array when required notarization keys are present', () => {
    expect(
      getMissingMacNotarizationEnv({
        APPLE_ID: 'user@example.com',
        APPLE_APP_SPECIFIC_PASSWORD: 'xxxx-xxxx-xxxx-xxxx',
        APPLE_TEAM_ID: 'TEAMID1234'
      })
    ).toEqual([]);
  });
});

describe('getNpmInvocation', () => {
  it('uses the npm CLI path when npm launched the script', () => {
    const invocation = getNpmInvocation(['run', 'build'], { npm_execpath: 'npm-cli.js' }, 'darwin');

    expect(invocation.command).toBe(process.execPath);
    expect(invocation.args).toEqual(['npm-cli.js', 'run', 'build']);
    expect(invocation.shell).toBe(false);
  });

  it('uses npm without shell on macOS', () => {
    const invocation = getNpmInvocation(['run', 'build'], {}, 'darwin');

    expect(invocation.command).toBe('npm');
    expect(invocation.shell).toBe(false);
  });
});

describe('getElectronBuilderInvocation', () => {
  it('pins native Apple Silicon packaging with publish disabled', () => {
    const invocation = getElectronBuilderInvocation('arm64');

    expect(invocation.command).toBe(process.execPath);
    expect(invocation.args[0]).toContain('electron-builder');
    expect(invocation.args).toEqual(
      expect.arrayContaining(['--mac', '--arm64', '--publish', 'never'])
    );
    expect(invocation.shell).toBe(false);
  });

  it('pins native Intel packaging with publish disabled', () => {
    const invocation = getElectronBuilderInvocation('x64');

    expect(invocation.args).toEqual(
      expect.arrayContaining(['--mac', '--x64', '--publish', 'never'])
    );
  });
});
