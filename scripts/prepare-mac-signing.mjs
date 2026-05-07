/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { open, readdir, stat } from 'fs/promises';
import { isBinaryFile } from 'isbinaryfile';
import { join, extname } from 'path';

const execFileAsync = promisify(execFile);
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

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  await stripSignaturesFromApp(appPath);
}
