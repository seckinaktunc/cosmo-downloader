/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const MAC_ENV_FILE = resolve(projectRoot, '.env.mac.local');
const REQUIRED_MAC_ENV_KEYS = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];

export function parseEnvFile(contents) {
  const values = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

export function getLocalMacBuildEnv(env = process.env, envFilePath = MAC_ENV_FILE) {
  const mergedEnv = { ...env };
  if (existsSync(envFilePath)) {
    const fileValues = parseEnvFile(readFileSync(envFilePath, 'utf8'));
    for (const [key, value] of Object.entries(fileValues)) {
      if (!mergedEnv[key]) {
        mergedEnv[key] = value;
      }
    }
  }

  return mergedEnv;
}

export function getMissingMacNotarizationEnv(env = process.env) {
  return REQUIRED_MAC_ENV_KEYS.filter((key) => !env[key]?.trim());
}

export function getNpmInvocation(args, env = process.env, platform = process.platform) {
  if (env.npm_execpath) {
    return {
      command: process.execPath,
      args: [env.npm_execpath, ...args],
      shell: false
    };
  }

  return {
    command: platform === 'win32' ? 'npm.cmd' : 'npm',
    args,
    shell: platform === 'win32'
  };
}

export function getElectronBuilderInvocation(arch = process.arch) {
  const archFlag = arch === 'arm64' ? '--arm64' : '--x64';

  return {
    command: process.execPath,
    args: [
      resolve(projectRoot, 'node_modules', 'electron-builder', 'cli.js'),
      '--mac',
      archFlag,
      '--publish',
      'never'
    ],
    shell: false
  };
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      cwd: projectRoot,
      ...options
    });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${exitCode}.`));
    });
  });
}

export async function runLocalMacBuild({
  env = process.env,
  platform = process.platform,
  arch = process.arch,
  envFilePath = MAC_ENV_FILE
} = {}) {
  if (platform !== 'darwin') {
    throw new Error('Local macOS builds must run on macOS.');
  }

  const resolvedEnv = getLocalMacBuildEnv(env, envFilePath);
  const missingKeys = getMissingMacNotarizationEnv(resolvedEnv);
  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required macOS notarization env vars: ${missingKeys.join(', ')}. ` +
        `Populate .env.mac.local or export them in your shell.`
    );
  }

  const download = getNpmInvocation(['run', 'download:binaries:current'], resolvedEnv, platform);
  await run(download.command, download.args, { env: resolvedEnv, shell: download.shell });

  const build = getNpmInvocation(['run', 'build'], resolvedEnv, platform);
  await run(build.command, build.args, { env: resolvedEnv, shell: build.shell });

  const electronBuilder = getElectronBuilderInvocation(arch);
  await run(electronBuilder.command, electronBuilder.args, {
    env: resolvedEnv,
    shell: electronBuilder.shell
  });

  await run(process.execPath, ['scripts/verify-mac-package.mjs', '--arch', arch], {
    env: resolvedEnv
  });
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  runLocalMacBuild().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
