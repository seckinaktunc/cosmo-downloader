/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const DEFAULT_DIST_DIR = 'dist';
const DEFAULT_MAC_VERIFY_TIMEOUT_MS = 60_000;

export function parseVerifyMacArgs(args = process.argv.slice(2)) {
  const options = {
    arch: process.arch,
    distDir: DEFAULT_DIST_DIR,
    requireDmg: true,
    requireZip: true
  };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === '--arch') {
      options.arch = args[index + 1] ?? options.arch;
      index += 1;
      continue;
    }

    if (value === '--dist-dir') {
      options.distDir = args[index + 1] ?? options.distDir;
      index += 1;
      continue;
    }

    if (value === '--zip-only') {
      options.requireDmg = false;
      options.requireZip = true;
      options.arch = options.arch === process.arch ? 'universal' : options.arch;
    }
  }

  return options;
}

export function getMacAppDirectoryCandidates(arch = process.arch) {
  if (arch === 'universal') {
    return ['mac-universal', 'mac-arm64', 'mac'];
  }

  if (arch === 'arm64') {
    return ['mac-arm64', 'mac-universal', 'mac'];
  }

  return ['mac', 'mac-x64', 'mac-universal'];
}

export function getNewestPath(paths, stat = statSync) {
  return [...paths].sort((left, right) => stat(right).mtimeMs - stat(left).mtimeMs)[0];
}

export function getNewestFileMatching(
  distDir,
  matcher,
  { readDir = readdirSync, stat = statSync } = {}
) {
  const matches = readDir(distDir)
    .filter((name) => matcher(name))
    .map((name) => join(distDir, name));

  return matches.length > 0 ? getNewestPath(matches, stat) : undefined;
}

export function getMacAppArtifactWithFs(
  distDir = DEFAULT_DIST_DIR,
  arch = process.arch,
  { readDir = readdirSync, stat = statSync } = {}
) {
  for (const directoryName of getMacAppDirectoryCandidates(arch)) {
    const directoryPath = join(distDir, directoryName);
    try {
      const matches = readDir(directoryPath)
        .filter((name) => name.endsWith('.app'))
        .map((name) => join(directoryPath, name));
      if (matches.length > 0) {
        return getNewestPath(matches, stat);
      }
    } catch {
      // Ignore missing per-arch directories.
    }
  }

  return undefined;
}

export function getMacDmgArtifactWithFs(
  distDir = DEFAULT_DIST_DIR,
  arch = process.arch,
  fsHelpers = {}
) {
  const archToken = arch === 'universal' ? 'universal' : `-${arch}.`;

  return getNewestFileMatching(
    distDir,
    (name) => name.endsWith('.dmg') && name.includes(archToken),
    fsHelpers
  );
}

export function getMacZipArtifactWithFs(
  distDir = DEFAULT_DIST_DIR,
  arch = process.arch,
  fsHelpers = {}
) {
  const archToken = arch === 'universal' ? 'universal' : `-${arch}.`;

  return getNewestFileMatching(
    distDir,
    (name) => name.endsWith('.zip') && !name.endsWith('.blockmap') && name.includes(archToken),
    fsHelpers
  );
}

export function getCodesignVerifyArgs(appPath) {
  return ['--verify', '--deep', '--strict', '--verbose=2', appPath];
}

export function getSpctlAssessArgs(appPath) {
  return ['--assess', '--verbose=4', '--type', 'execute', appPath];
}

export function getStaplerValidateArgs(targetPath) {
  return ['stapler', 'validate', targetPath];
}

function runCommand(command, args, { env = process.env, spawnProcess = spawn, timeoutMs } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawnProcess(command, args, {
      stdio: 'inherit',
      shell: false,
      env
    });

    let settled = false;
    const timer =
      timeoutMs == null
        ? null
        : setTimeout(() => {
            if (settled) {
              return;
            }

            settled = true;
            child.kill?.('SIGKILL');
            reject(new Error(`${command} ${args.join(' ')} timed out after ${timeoutMs}ms.`));
          }, timeoutMs);

    child.on('error', (error) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      reject(error);
    });

    child.on('close', (exitCode, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timer) {
        clearTimeout(timer);
      }

      if (exitCode === 0) {
        resolvePromise();
        return;
      }

      const outcome = signal ? `signal ${signal}` : `code ${exitCode}`;
      reject(new Error(`${command} ${args.join(' ')} failed with ${outcome}.`));
    });
  });
}

export async function verifyMacPackage({
  arch = process.arch,
  distDir = DEFAULT_DIST_DIR,
  requireDmg = true,
  requireZip = true,
  platform = process.platform,
  env = process.env,
  timeoutMs = DEFAULT_MAC_VERIFY_TIMEOUT_MS,
  getAppArtifact = getMacAppArtifactWithFs,
  getDmgArtifact = getMacDmgArtifactWithFs,
  getZipArtifact = getMacZipArtifactWithFs,
  pathExists = existsSync,
  spawnProcess = spawn
} = {}) {
  if (platform !== 'darwin') {
    throw new Error('macOS package verification must run on macOS.');
  }

  const appArtifact = getAppArtifact(distDir, arch);
  if (!appArtifact || !pathExists(appArtifact)) {
    throw new Error(`No macOS app artifact found in ${distDir} for ${arch}.`);
  }

  const zipArtifact = requireZip ? getZipArtifact(distDir, arch) : undefined;
  if (requireZip && (!zipArtifact || !pathExists(zipArtifact))) {
    throw new Error(`No macOS ZIP artifact found in ${distDir} for ${arch}.`);
  }

  const dmgArtifact = requireDmg ? getDmgArtifact(distDir, arch) : undefined;
  if (requireDmg && (!dmgArtifact || !pathExists(dmgArtifact))) {
    throw new Error(`No macOS DMG artifact found in ${distDir} for ${arch}.`);
  }

  await runCommand('codesign', getCodesignVerifyArgs(appArtifact), {
    env,
    spawnProcess,
    timeoutMs
  });
  await runCommand('spctl', getSpctlAssessArgs(appArtifact), {
    env,
    spawnProcess,
    timeoutMs
  });
  await runCommand('xcrun', getStaplerValidateArgs(appArtifact), {
    env,
    spawnProcess,
    timeoutMs
  });

  if (dmgArtifact) {
    await runCommand('xcrun', getStaplerValidateArgs(dmgArtifact), {
      env,
      spawnProcess,
      timeoutMs
    });
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  verifyMacPackage(parseVerifyMacArgs())
    .then(() => {
      console.log('macOS package verification passed.');
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
