/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

export function getWindowsSigningArtifacts(distDir = 'dist') {
  const unpackedExecutable = join(distDir, 'win-unpacked', 'Cosmo Downloader.exe');
  const setupExecutable = readdirSync(distDir)
    .filter((name) => /setup\.exe$/i.test(name))
    .map((name) => join(distDir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];

  return [unpackedExecutable, setupExecutable].filter(Boolean);
}

export function evaluateSignature(status) {
  return status === 'Valid';
}

function quotePowerShellString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function readAuthenticodeStatus(filePath) {
  const command = [
    `$signature = Get-AuthenticodeSignature -LiteralPath ${quotePowerShellString(filePath)}`,
    '[PSCustomObject]@{ Status = [string]$signature.Status; StatusMessage = $signature.StatusMessage } | ConvertTo-Json -Compress'
  ].join('; ');
  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', command], {
    windowsHide: true
  });
  return JSON.parse(stdout.trim());
}

export async function verifyWindowsSigning({
  distDir = 'dist',
  getArtifacts = getWindowsSigningArtifacts,
  readSignature = readAuthenticodeStatus,
  pathExists = existsSync
} = {}) {
  const artifacts = getArtifacts(distDir);
  if (artifacts.length === 0) {
    throw new Error(`No Windows artifacts found in ${distDir}.`);
  }

  const failures = [];
  for (const artifact of artifacts) {
    if (!pathExists(artifact)) {
      failures.push(`${artifact}: missing`);
      continue;
    }

    const signature = await readSignature(artifact);
    if (!evaluateSignature(signature.Status)) {
      failures.push(
        `${artifact}: ${signature.Status} (${signature.StatusMessage ?? 'no details'})`
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(`Unsigned or invalid Windows artifacts:\n${failures.join('\n')}`);
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  verifyWindowsSigning()
    .then(() => {
      console.log('Windows artifacts are signed.');
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
