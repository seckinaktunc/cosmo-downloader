/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { open, readdir, stat, mkdir, writeFile } from 'fs/promises';
import { isBinaryFile } from 'isbinaryfile';
import { join, extname } from 'path';

const execFileAsync = promisify(execFile);
const MAC_UPDATE_BASE_URL =
  'https://github.com/seckinaktunc/cosmo-downloader/releases/latest/download/';
const MAC_UPDATER_CACHE_DIR_NAME = 'cosmo-downloader-updater';
const SIGNABLE_DIRECTORY_EXTENSIONS = new Set([
  '.app',
  '.framework',
  '.appex',
  '.bundle',
  '.plugin',
  '.xpc'
]);
const MACH_O_MAGIC_HEADERS = new Set([
  'feedface',
  'cefaedfe',
  'feedfacf',
  'cffaedfe',
  'cafebabe',
  'bebafeca'
]);
const NOT_SIGNED_ERROR_SNIPPET = 'code object is not signed at all';

export async function collectSignablePaths(dirPath) {
  const children = await readdir(dirPath);
  const paths = [];

  for (const child of children) {
    const filePath = join(dirPath, child);
    const fileStat = await stat(filePath);

    if (fileStat.isFile()) {
      if (extname(filePath) === '.cstemp') {
        continue;
      }

      if (await isBinaryFile(filePath)) {
        paths.push(filePath);
      }
      continue;
    }

    if (!fileStat.isDirectory()) {
      continue;
    }

    paths.push(...(await collectSignablePaths(filePath)));

    if (SIGNABLE_DIRECTORY_EXTENSIONS.has(extname(filePath))) {
      paths.push(filePath);
    }
  }

  return paths;
}

export async function isMachOFile(filePath) {
  const fileHandle = await open(filePath, 'r');

  try {
    const header = Buffer.alloc(4);
    const { bytesRead } = await fileHandle.read(header, 0, header.length, 0);
    return bytesRead === header.length && MACH_O_MAGIC_HEADERS.has(header.toString('hex'));
  } finally {
    await fileHandle.close();
  }
}

export async function collectCodeSignPaths(dirPath) {
  const children = await readdir(dirPath);
  const paths = [];

  for (const child of children) {
    const filePath = join(dirPath, child);
    const fileStat = await stat(filePath);

    if (fileStat.isFile()) {
      if (extname(filePath) === '.cstemp') {
        continue;
      }

      if (await isMachOFile(filePath)) {
        paths.push(filePath);
      }
      continue;
    }

    if (!fileStat.isDirectory()) {
      continue;
    }

    paths.push(...(await collectCodeSignPaths(filePath)));

    if (SIGNABLE_DIRECTORY_EXTENSIONS.has(extname(filePath))) {
      paths.push(filePath);
    }
  }

  return paths;
}

export async function removeSignature(filePath) {
  try {
    await execFileAsync('codesign', ['--remove-signature', filePath]);
    return true;
  } catch (error) {
    const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr || '') : '';
    if (stderr.includes(NOT_SIGNED_ERROR_SNIPPET)) {
      return false;
    }

    throw error;
  }
}

export async function stripSignaturesFromApp(appPath) {
  const contentsPath = join(appPath, 'Contents');
  const signablePaths = await collectSignablePaths(contentsPath);

  // Remove any upstream Electron signatures so electron-builder can apply a fresh
  // Developer ID signature with a secure timestamp on macOS 26+.
  const removed = [];
  for (const filePath of [...signablePaths, appPath]) {
    if (await removeSignature(filePath)) {
      removed.push(filePath);
    }
  }

  if (removed.length > 0) {
    console.log(
      `prepare-mac-signing: stripped ${removed.length} existing signatures from ${appPath}`
    );
  }
}

export function inferMacUpdaterArch(appPath, archHint) {
  if (archHint === 'arm64' || archHint === 'x64') {
    return archHint;
  }

  const normalizedPath = appPath.toLowerCase();
  if (normalizedPath.includes('arm64')) {
    return 'arm64';
  }

  if (normalizedPath.includes('x64')) {
    return 'x64';
  }

  return process.arch === 'arm64' ? 'arm64' : 'x64';
}

export function serializeMacUpdateConfig(arch) {
  const channel = arch === 'arm64' ? 'latest-arm64-mac' : 'latest-x64-mac';

  return [
    `provider: ${JSON.stringify('generic')}`,
    `url: ${JSON.stringify(MAC_UPDATE_BASE_URL)}`,
    `channel: ${JSON.stringify(channel)}`,
    `updaterCacheDirName: ${JSON.stringify(MAC_UPDATER_CACHE_DIR_NAME)}`,
    ''
  ].join('\n');
}

export async function writeMacAppUpdateConfig(appPath, arch) {
  const resourcesPath = join(appPath, 'Contents', 'Resources');
  const configPath = join(resourcesPath, 'app-update.yml');

  await mkdir(resourcesPath, { recursive: true });
  await writeFile(configPath, serializeMacUpdateConfig(arch), 'utf8');
  return configPath;
}

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  if (context.packager?.packagerOptions?.prepackaged != null) {
    return;
  }

  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  await writeMacAppUpdateConfig(appPath, inferMacUpdaterArch(appPath));
  await stripSignaturesFromApp(appPath);
}
