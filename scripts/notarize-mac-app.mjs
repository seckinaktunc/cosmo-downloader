/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { mkdtemp, rm } from 'fs/promises';
import { spawn } from 'child_process';
import { basename, dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const DEFAULT_NOTARIZATION_TIMEOUT_MS = 360 * 60 * 1000;
const DEFAULT_NOTARIZATION_POLL_INTERVAL_MS = 60_000;

export function parseNotarizeMacArgs(args = process.argv.slice(2)) {
  const options = {
    appPath: undefined,
    timeoutMs: DEFAULT_NOTARIZATION_TIMEOUT_MS,
    pollIntervalMs: DEFAULT_NOTARIZATION_POLL_INTERVAL_MS
  };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === '--app') {
      options.appPath = args[index + 1] ?? options.appPath;
      index += 1;
      continue;
    }

    if (value === '--timeout-ms') {
      const parsed = Number(args[index + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.timeoutMs = parsed;
      }
      index += 1;
      continue;
    }

    if (value === '--poll-interval-ms') {
      const parsed = Number(args[index + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.pollIntervalMs = parsed;
      }
      index += 1;
    }
  }

  return options;
}

export function getNotaryAuthArgs(env = process.env) {
  if (env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER) {
    return [
      '--key',
      env.APPLE_API_KEY,
      '--key-id',
      env.APPLE_API_KEY_ID,
      '--issuer',
      env.APPLE_API_ISSUER
    ];
  }

  if (env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID) {
    return [
      '--apple-id',
      env.APPLE_ID,
      '--password',
      env.APPLE_APP_SPECIFIC_PASSWORD,
      '--team-id',
      env.APPLE_TEAM_ID
    ];
  }

  throw new Error(
    'Missing Apple notarization credentials. Provide either APPLE_API_KEY / APPLE_API_KEY_ID / APPLE_API_ISSUER or APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID.'
  );
}

export function getNotarySubmitArgs(zipPath, env = process.env) {
  return ['notarytool', 'submit', zipPath, ...getNotaryAuthArgs(env), '--output-format', 'json'];
}

export function getNotaryInfoArgs(submissionId, env = process.env) {
  return ['notarytool', 'info', submissionId, ...getNotaryAuthArgs(env), '--output-format', 'json'];
}

export function getNotaryLogArgs(submissionId, env = process.env) {
  return ['notarytool', 'log', submissionId, ...getNotaryAuthArgs(env)];
}

export function getStaplerStapleArgs(appPath) {
  return ['stapler', 'staple', '-v', appPath];
}

export function getNotarizationZipArgs(appName, zipPath) {
  return ['-c', '-k', '--sequesterRsrc', '--keepParent', appName, zipPath];
}

export function normalizeNotarizationStatus(status) {
  return String(status ?? '')
    .trim()
    .toLowerCase();
}

function runCommand(
  command,
  args,
  { cwd, env = process.env, spawnProcess = spawn, timeoutMs } = {}
) {
  return new Promise((resolvePromise, reject) => {
    const child = spawnProcess(command, args, {
      cwd,
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
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

    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });

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
        resolvePromise({ stdout, stderr });
        return;
      }

      const outcome = signal ? `signal ${signal}` : `code ${exitCode}`;
      reject(
        new Error(
          `${command} ${args.join(' ')} failed with ${outcome}.${stderr.trim() ? `\n${stderr.trim()}` : ''}`
        )
      );
    });
  });
}

export async function notarizeMacApp({
  appPath,
  env = process.env,
  platform = process.platform,
  pollIntervalMs = DEFAULT_NOTARIZATION_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_NOTARIZATION_TIMEOUT_MS,
  commandRunner = runCommand,
  delay = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms)),
  createTempDir = (prefix) => mkdtemp(join(tmpdir(), prefix)),
  removeTempDir = (dirPath) => rm(dirPath, { recursive: true, force: true })
} = {}) {
  if (platform !== 'darwin') {
    throw new Error('macOS notarization must run on macOS.');
  }

  if (!appPath) {
    throw new Error('Missing required macOS app path.');
  }

  const tempDir = await createTempDir('cosmo-notary-');
  const appName = basename(appPath);
  const zipPath = join(tempDir, `${appName.replace(/\.app$/i, '')}.zip`);
  const startedAt = Date.now();
  let lastStatus = 'unknown';

  try {
    console.log(`notarize-mac-app: creating notarization archive for ${appName}`);
    await commandRunner('ditto', getNotarizationZipArgs(appName, zipPath), {
      cwd: dirname(appPath),
      env
    });

    console.log(`notarize-mac-app: submitting ${appName} to Apple`);
    const submitResult = await commandRunner('xcrun', getNotarySubmitArgs(zipPath, env), { env });
    const submitInfo = JSON.parse(submitResult.stdout);
    const submissionId = submitInfo.id;

    if (!submissionId) {
      throw new Error(
        `Apple notarization submission did not return an id.${submitResult.stdout.trim() ? `\n${submitResult.stdout.trim()}` : ''}`
      );
    }

    console.log(`notarize-mac-app: submitted ${submissionId} for ${appName}`);

    while (Date.now() - startedAt < timeoutMs) {
      const infoResult = await commandRunner('xcrun', getNotaryInfoArgs(submissionId, env), {
        env
      });
      const info = JSON.parse(infoResult.stdout);
      lastStatus = normalizeNotarizationStatus(info.status);
      console.log(`notarize-mac-app: ${submissionId} status ${info.status}`);

      if (lastStatus === 'accepted') {
        console.log(`notarize-mac-app: stapling accepted ticket to ${appName}`);
        await commandRunner('xcrun', getStaplerStapleArgs(appPath), { env });
        return;
      }

      if (lastStatus === 'invalid' || lastStatus === 'rejected') {
        const logResult = await commandRunner('xcrun', getNotaryLogArgs(submissionId, env), {
          env
        });
        throw new Error(
          `Apple notarization failed for ${appName} with status ${info.status}.${logResult.stdout.trim() ? `\n${logResult.stdout.trim()}` : ''}`
        );
      }

      await delay(pollIntervalMs);
    }

    throw new Error(
      `Timed out waiting for Apple notarization for ${appName} after ${timeoutMs}ms. Last known status: ${lastStatus}.`
    );
  } finally {
    await removeTempDir(tempDir);
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  notarizeMacApp(parseNotarizeMacArgs()).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
