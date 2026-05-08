/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { sign } from '@electron/osx-sign';
import { realpath } from 'fs/promises';
import { join, sep } from 'path';
import {
  collectCodeSignPaths,
  inferMacUpdaterArch,
  stripSignaturesFromApp,
  writeMacAppUpdateConfig
} from './prepare-mac-signing.mjs';

const SIGN_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getPathDepth(filePath) {
  return filePath.split(sep).length;
}

async function getDuplicateAliasPaths(appPath) {
  const codeSignPaths = await collectCodeSignPaths(join(appPath, 'Contents'));
  codeSignPaths.sort((left, right) => getPathDepth(right) - getPathDepth(left));

  const seenRealPaths = new Map();
  const duplicateAliases = new Set();

  for (const filePath of codeSignPaths) {
    const resolvedPath = await realpath(filePath);
    if (seenRealPaths.has(resolvedPath)) {
      duplicateAliases.add(filePath);
      continue;
    }

    seenRealPaths.set(resolvedPath, filePath);
  }

  return duplicateAliases;
}

function getOptionsForFileWithTimestampPolicy(optionsForFile, codeSignPaths) {
  return (filePath) => {
    const options = optionsForFile ? optionsForFile(filePath) : undefined;

    if (codeSignPaths.has(filePath) || filePath.endsWith('.app')) {
      return options;
    }

    return {
      ...options,
      timestamp: 'none'
    };
  };
}

function shouldIgnoreFile(filePath, ignore) {
  if (!ignore) {
    return false;
  }

  if (Array.isArray(ignore)) {
    return ignore.some((entry) =>
      typeof entry === 'function' ? entry(filePath) : Boolean(filePath.match(entry))
    );
  }

  return typeof ignore === 'function' ? ignore(filePath) : Boolean(filePath.match(ignore));
}

export function shouldIgnoreMacSignPath(
  filePath,
  { appPath, codeSignPaths, duplicateAliasPaths, ignore }
) {
  return (
    (!codeSignPaths.has(filePath) && filePath !== appPath) ||
    duplicateAliasPaths.has(filePath) ||
    shouldIgnoreFile(filePath, ignore)
  );
}

export default async function customMacSign(opts) {
  let lastError;
  const codeSignPaths = new Set(await collectCodeSignPaths(join(opts.app, 'Contents')));
  const duplicateAliasPaths = await getDuplicateAliasPaths(opts.app);
  const macUpdaterArch = inferMacUpdaterArch(opts.app);
  const signingOpts = {
    ...opts,
    ignore: (filePath) =>
      shouldIgnoreMacSignPath(filePath, {
        appPath: opts.app,
        codeSignPaths,
        duplicateAliasPaths,
        ignore: opts.ignore
      }),
    optionsForFile: getOptionsForFileWithTimestampPolicy(opts.optionsForFile, codeSignPaths)
  };

  for (let attempt = 1; attempt <= SIGN_ATTEMPTS; attempt += 1) {
    console.log(`custom-mac-sign: starting sign attempt ${attempt} for ${opts.app}`);
    await writeMacAppUpdateConfig(opts.app, macUpdaterArch);
    await stripSignaturesFromApp(opts.app);

    try {
      await sign(signingOpts);
      console.log(`custom-mac-sign: sign attempt ${attempt} completed successfully`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === SIGN_ATTEMPTS) {
        break;
      }

      console.warn(
        `custom-mac-sign: sign attempt ${attempt} failed; retrying in ${RETRY_DELAY_MS / 1000}s`
      );
      await delay(RETRY_DELAY_MS);
    }
  }

  throw lastError;
}
