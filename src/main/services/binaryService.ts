import { app } from 'electron';
import { chmodSync, existsSync } from 'fs';
import { join } from 'path';

export type BinaryPaths = {
  ytdlp: string;
  deno: string;
  ffmpeg: string;
  ffprobe?: string;
};

export class BinaryMissingError extends Error {
  constructor(binaryName: string, expectedPath: string) {
    super(`${binaryName} was not found at ${expectedPath}. Run npm run download:binaries.`);
    this.name = 'BinaryMissingError';
  }
}

function getPlatformDirectory(): string {
  return `${process.platform}-${process.arch}`;
}

function getResourcesRoot(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  }

  return join(app.getAppPath(), 'resources');
}

function executableName(baseName: string): string {
  return process.platform === 'win32' ? `${baseName}.exe` : baseName;
}

function ensureExecutable(filePath: string): void {
  if (process.platform !== 'win32' && existsSync(filePath)) {
    chmodSync(filePath, 0o755);
  }
}

export class BinaryService {
  getPaths(): BinaryPaths {
    const directory = join(getResourcesRoot(), 'bin', getPlatformDirectory());
    const ytdlp = join(directory, executableName('yt-dlp'));
    const deno = join(directory, executableName('deno'));
    const ffmpeg = join(directory, executableName('ffmpeg'));
    const ffprobe = join(directory, executableName('ffprobe'));

    this.assertBinary('yt-dlp', ytdlp);
    this.assertBinary('deno', deno);
    this.assertBinary('ffmpeg', ffmpeg);
    ensureExecutable(ytdlp);
    ensureExecutable(deno);
    ensureExecutable(ffmpeg);

    if (existsSync(ffprobe)) {
      ensureExecutable(ffprobe);
      return { ytdlp, deno, ffmpeg, ffprobe };
    }

    return { ytdlp, deno, ffmpeg };
  }

  private assertBinary(name: string, filePath: string): void {
    if (!existsSync(filePath)) {
      throw new BinaryMissingError(name, filePath);
    }
  }
}
