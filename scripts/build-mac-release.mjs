/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { existsSync } from 'fs';
import { rename, rm } from 'fs/promises';
import { spawn } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { notarizeMacApp } from './notarize-mac-app.mjs';
import { getMacAppArtifactWithFs, verifyMacPackage } from './verify-mac-package.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const DEFAULT_DIST_DIR = resolve(projectRoot, 'dist');
const SUPPORTED_MAC_ARCHES = new Set(['arm64', 'x64']);

export function parseMacReleaseArgs(args = process.argv.slice(2)) {
  const options = {
    arch: process.arch,
    distDir: DEFAULT_DIST_DIR
  };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === '--arch') {
      options.arch = args[index + 1] ?? options.arch;
      index += 1;
      continue;
    }

    if (value === '--dist-dir') {
      options.distDir = resolve(args[index + 1] ?? options.distDir);
      index += 1;
    }
  }

  return options;
}

export function getMacDirBuildInvocation(arch) {
  return {
    command: process.execPath,
    args: [
      resolve(projectRoot, 'node_modules', 'electron-builder', 'cli.js'),
      '--mac',
      '--dir',
      arch === 'arm64' ? '--arm64' : '--x64',
      '--publish',
      'never'
    ],
    shell: false
  };
}

export function getMacPackageInvocation({ arch, appPath }) {
  return {
    command: process.execPath,
    args: [
      resolve(projectRoot, 'node_modules', 'electron-builder', 'cli.js'),
      '--mac',
      'dmg',
      'zip',
      arch === 'arm64' ? '--arm64' : '--x64',
      '--publish',
      'never',
      '--prepackaged',
      appPath
    ],
    shell: false
  };
}

export function getMacUpdateManifestName(arch) {
  return arch === 'arm64' ? 'latest-arm64-mac.yml' : 'latest-x64-mac.yml';
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

async function moveMacUpdateManifest(distDir, arch) {
  const sourcePath = resolve(distDir, 'latest-mac.yml');
  const destinationPath = resolve(distDir, getMacUpdateManifestName(arch));
  await rm(destinationPath, { force: true });
  await rename(sourcePath, destinationPath);
  return destinationPath;
}

export async function runMacReleaseBuild({
  arch = process.arch,
  distDir = DEFAULT_DIST_DIR,
  env = process.env,
  platform = process.platform,
  commandRunner = run,
  notarizeApp = notarizeMacApp,
  verifyPackage = verifyMacPackage
} = {}) {
  if (platform !== 'darwin') {
    throw new Error('Mac release packaging must run on macOS.');
  }

  if (!SUPPORTED_MAC_ARCHES.has(arch)) {
    throw new Error(`Unsupported macOS architecture "${arch}". Expected one of: arm64, x64.`);
  }

  const dirBuild = getMacDirBuildInvocation(arch);
  console.log(`build-mac-release: creating signed ${arch} app bundle`);
  await commandRunner(dirBuild.command, dirBuild.args, { env, shell: dirBuild.shell });

  const appArtifact = getMacAppArtifactWithFs(distDir, arch);
  if (!appArtifact || !existsSync(appArtifact)) {
    throw new Error(`No macOS app artifact found in ${distDir} for ${arch} after --dir build.`);
  }

  await notarizeApp({
    appPath: appArtifact,
    env,
    platform
  });

  await rm(resolve(distDir, 'latest-mac.yml'), { force: true });
  await rm(resolve(distDir, getMacUpdateManifestName(arch)), { force: true });

  const packageBuild = getMacPackageInvocation({ arch, appPath: appArtifact });
  console.log(`build-mac-release: packaging stapled ${arch} app into dmg/zip artifacts`);
  await commandRunner(packageBuild.command, packageBuild.args, {
    env,
    shell: packageBuild.shell
  });

  await moveMacUpdateManifest(distDir, arch);

  await verifyPackage({
    arch,
    distDir,
    env,
    platform
  });
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  runMacReleaseBuild(parseMacReleaseArgs()).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
