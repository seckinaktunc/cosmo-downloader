/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync
} from 'node:fs';
import { chmod, mkdtemp } from 'node:fs/promises';
import { get } from 'node:https';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resourcesDir = join(root, 'resources', 'bin');

const YTDLP_VERSION = '2026.03.17';
const DENO_VERSION = '2.7.13';
const DOWNLOAD_TIMEOUT_MS = 60_000;

const ytdlpBase = `https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}`;
const denoBase = `https://github.com/denoland/deno/releases/download/v${DENO_VERSION}`;
const gyanReleaseEssentials = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
const johnVanSickleBase = 'https://johnvansickle.com/ffmpeg/releases';
const evermeetBase = 'https://evermeet.cx/ffmpeg';
const osxExpertsBase = 'https://www.osxexperts.net';

const platforms = {
  'win32-x64': {
    ytDlp: { url: `${ytdlpBase}/yt-dlp.exe`, output: 'yt-dlp.exe' },
    deno: {
      url: `${denoBase}/deno-x86_64-pc-windows-msvc.zip`,
      archiveName: 'deno-x86_64-pc-windows-msvc.zip',
      output: 'deno.exe',
      binary: 'deno.exe'
    },
    ffmpeg: [
      {
        url: gyanReleaseEssentials,
        archiveName: 'ffmpeg-release-essentials.zip',
        binary: 'ffmpeg.exe',
        sourcePath: 'bin/ffmpeg.exe'
      },
      {
        url: gyanReleaseEssentials,
        archiveName: 'ffmpeg-release-essentials.zip',
        binary: 'ffprobe.exe',
        sourcePath: 'bin/ffprobe.exe'
      }
    ]
  },
  'win32-arm64': {
    ytDlp: { url: `${ytdlpBase}/yt-dlp.exe`, output: 'yt-dlp.exe' },
    deno: {
      url: `${denoBase}/deno-aarch64-pc-windows-msvc.zip`,
      archiveName: 'deno-aarch64-pc-windows-msvc.zip',
      output: 'deno.exe',
      binary: 'deno.exe'
    },
    ffmpeg: [
      {
        url: gyanReleaseEssentials,
        archiveName: 'ffmpeg-release-essentials.zip',
        binary: 'ffmpeg.exe',
        sourcePath: 'bin/ffmpeg.exe'
      },
      {
        url: gyanReleaseEssentials,
        archiveName: 'ffmpeg-release-essentials.zip',
        binary: 'ffprobe.exe',
        sourcePath: 'bin/ffprobe.exe'
      }
    ]
  },
  'linux-x64': {
    ytDlp: { url: `${ytdlpBase}/yt-dlp_linux`, output: 'yt-dlp' },
    deno: {
      url: `${denoBase}/deno-x86_64-unknown-linux-gnu.zip`,
      archiveName: 'deno-x86_64-unknown-linux-gnu.zip',
      output: 'deno',
      binary: 'deno'
    },
    ffmpeg: [
      {
        url: `${johnVanSickleBase}/ffmpeg-release-amd64-static.tar.xz`,
        archiveName: 'ffmpeg-release-amd64-static.tar.xz',
        binary: 'ffmpeg'
      },
      {
        url: `${johnVanSickleBase}/ffmpeg-release-amd64-static.tar.xz`,
        archiveName: 'ffmpeg-release-amd64-static.tar.xz',
        binary: 'ffprobe'
      }
    ]
  },
  'linux-arm64': {
    ytDlp: { url: `${ytdlpBase}/yt-dlp_linux_aarch64`, output: 'yt-dlp' },
    deno: {
      url: `${denoBase}/deno-aarch64-unknown-linux-gnu.zip`,
      archiveName: 'deno-aarch64-unknown-linux-gnu.zip',
      output: 'deno',
      binary: 'deno'
    },
    ffmpeg: [
      {
        url: `${johnVanSickleBase}/ffmpeg-release-arm64-static.tar.xz`,
        archiveName: 'ffmpeg-release-arm64-static.tar.xz',
        binary: 'ffmpeg'
      },
      {
        url: `${johnVanSickleBase}/ffmpeg-release-arm64-static.tar.xz`,
        archiveName: 'ffmpeg-release-arm64-static.tar.xz',
        binary: 'ffprobe'
      }
    ]
  },
  'darwin-x64': {
    ytDlp: { url: `${ytdlpBase}/yt-dlp_macos`, output: 'yt-dlp' },
    deno: {
      url: `${denoBase}/deno-x86_64-apple-darwin.zip`,
      archiveName: 'deno-x86_64-apple-darwin.zip',
      output: 'deno',
      binary: 'deno'
    },
    ffmpeg: [
      {
        url: `${evermeetBase}/getrelease/zip`,
        archiveName: 'ffmpeg-macos-x64-release.zip',
        binary: 'ffmpeg'
      },
      {
        url: `${evermeetBase}/getrelease/ffprobe/zip`,
        archiveName: 'ffprobe-macos-x64-release.zip',
        binary: 'ffprobe'
      }
    ]
  },
  'darwin-arm64': {
    ytDlp: { url: `${ytdlpBase}/yt-dlp_macos`, output: 'yt-dlp' },
    deno: {
      url: `${denoBase}/deno-aarch64-apple-darwin.zip`,
      archiveName: 'deno-aarch64-apple-darwin.zip',
      output: 'deno',
      binary: 'deno'
    },
    ffmpeg: [
      {
        url: `${osxExpertsBase}/ffmpeg81arm.zip`,
        archiveName: 'ffmpeg81arm.zip',
        binary: 'ffmpeg',
        archive: true
      },
      {
        url: `${osxExpertsBase}/ffprobe81arm.zip`,
        archiveName: 'ffprobe81arm.zip',
        binary: 'ffprobe',
        archive: true
      }
    ]
  }
};

function isExistingBinary(filePath) {
  return existsSync(filePath) && statSync(filePath).isFile() && statSync(filePath).size > 0;
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    mkdirSync(dirname(destination), { recursive: true });
    let settled = false;
    const request = get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        download(response.headers.location, destination).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        return;
      }

      const file = createWriteStream(destination);
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          settled = true;
          resolve();
        });
      });
      file.on('error', (error) => {
        settled = true;
        reject(error);
      });
    });

    request.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
      request.destroy(
        new Error(`Timed out downloading ${url} after ${DOWNLOAD_TIMEOUT_MS / 1000} seconds.`)
      );
    });
    request.on('error', (error) => {
      if (!settled) {
        rmSync(destination, { force: true });
        reject(error);
      }
    });
  });
}

function normalizeArchivePath(value) {
  return value.replaceAll('\\', '/').replace(/^\/+/, '');
}

function findBinary(directory, binaryName, sourcePath) {
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      const found = findBinary(entryPath, binaryName, sourcePath);
      if (found) return found;
    }

    const normalizedEntryPath = normalizeArchivePath(entryPath);
    const normalizedSourcePath = sourcePath ? normalizeArchivePath(sourcePath) : null;
    const sourcePathMatches =
      normalizedSourcePath &&
      (normalizedEntryPath.endsWith(`/${normalizedSourcePath}`) ||
        normalizedEntryPath.endsWith(normalizedSourcePath));

    if (entry.isFile() && (sourcePathMatches || entry.name === binaryName)) {
      return entryPath;
    }
  }

  return null;
}

function moveFile(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });

  try {
    renameSync(source, destination);
  } catch (error) {
    if (error && error.code === 'EXDEV') {
      copyFileSync(source, destination);
      rmSync(source, { force: true });
      return;
    }

    throw error;
  }
}

/**
 * On Windows, some `tar` builds mis-parse paths like `C:\...` ("Cannot connect to C: resolve failed").
 * PowerShell's Expand-Archive is reliable for .zip without extra tools.
 */
function extractZipWindows(archivePath, destDir) {
  return spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Expand-Archive -LiteralPath $env:COSMO_ARCHIVE_PATH -DestinationPath $env:COSMO_DEST_DIR -Force'
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        COSMO_ARCHIVE_PATH: archivePath,
        COSMO_DEST_DIR: destDir
      }
    }
  );
}

function pathForSystemTar(absolutePath) {
  // Avoid Windows drive-letter parsing bugs in some tar/libarchive builds.
  if (process.platform === 'win32') {
    return absolutePath.replaceAll('\\', '/');
  }
  return absolutePath;
}

async function extractArchive(archivePath, binaryName, destination, sourcePath) {
  const tempDir = await mkdtemp(join(tmpdir(), 'cosmo-bin-'));
  const isZip = archivePath.toLowerCase().endsWith('.zip');
  const result =
    process.platform === 'win32' && isZip
      ? extractZipWindows(archivePath, tempDir)
      : spawnSync('tar', ['-xf', pathForSystemTar(archivePath), '-C', pathForSystemTar(tempDir)], {
          stdio: 'inherit'
        });
  if (result.status !== 0) {
    throw new Error(
      `Failed to extract ${basename(archivePath)}. Install tar or extract it manually.`
    );
  }

  const binaryPath = findBinary(tempDir, binaryName, sourcePath);
  if (!binaryPath) {
    throw new Error(`Could not find ${binaryName} inside ${basename(archivePath)}.`);
  }

  moveFile(binaryPath, destination);
  rmSync(tempDir, { recursive: true, force: true });
}

function archivePathForAsset(targetDir, asset) {
  return join(targetDir, asset.archiveName ?? basename(asset.url));
}

async function downloadPlatform(platformKey) {
  const manifest = platforms[platformKey];
  if (!manifest) {
    throw new Error(`No binary manifest exists for ${platformKey}.`);
  }

  const targetDir = join(resourcesDir, platformKey);
  mkdirSync(targetDir, { recursive: true });
  const downloadedArchives = new Map();

  const ytdlpPath = join(targetDir, manifest.ytDlp.output);
  if (isExistingBinary(ytdlpPath)) {
    console.log(`Using existing yt-dlp ${YTDLP_VERSION} for ${platformKey}`);
  } else {
    console.log(`Downloading yt-dlp ${YTDLP_VERSION} for ${platformKey}`);
    await download(manifest.ytDlp.url, ytdlpPath);
  }
  await chmod(ytdlpPath, 0o755);

  const denoPath = join(targetDir, manifest.deno.output);
  if (isExistingBinary(denoPath)) {
    console.log(`Using existing Deno ${DENO_VERSION} for ${platformKey}`);
  } else {
    console.log(`Downloading Deno ${DENO_VERSION} for ${platformKey}`);
    const archivePath = archivePathForAsset(targetDir, manifest.deno);
    if (!downloadedArchives.has(manifest.deno.url)) {
      await download(manifest.deno.url, archivePath);
      downloadedArchives.set(manifest.deno.url, archivePath);
    }
    await extractArchive(archivePath, manifest.deno.binary, denoPath, manifest.deno.sourcePath);
  }
  await chmod(denoPath, 0o755);

  for (const asset of manifest.ffmpeg) {
    const destination = join(targetDir, asset.binary);
    if (isExistingBinary(destination)) {
      console.log(`Using existing ${asset.binary} for ${platformKey}`);
      await chmod(destination, 0o755);
      continue;
    }

    console.log(`Downloading ${asset.binary} for ${platformKey}`);
    if (asset.direct) {
      await download(asset.url, destination);
    } else {
      const archivePath = archivePathForAsset(targetDir, asset);
      if (!downloadedArchives.has(asset.url)) {
        await download(asset.url, archivePath);
        downloadedArchives.set(asset.url, archivePath);
      }
      await extractArchive(archivePath, asset.binary, destination, asset.sourcePath);
    }
    await chmod(destination, 0o755);
  }

  for (const archivePath of downloadedArchives.values()) {
    rmSync(archivePath, { force: true });
  }
}

const requestedPlatforms = process.argv.includes('--all')
  ? Object.keys(platforms)
  : [`${process.platform}-${process.arch}`];

for (const platformKey of requestedPlatforms) {
  await downloadPlatform(platformKey);
}

console.log('Binary download complete.');
