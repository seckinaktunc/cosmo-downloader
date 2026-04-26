import { app, webContents } from 'electron';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';
import { BinaryMissingError, BinaryService } from './binaryService';
import { IPC_CHANNELS } from '../../shared/ipc';
import { captureProcess } from '../utils/process';
import { classifyVideoUrl, validateUrl } from '../../shared/url';
import type {
  AppSettings,
  DownloadLogAppend,
  IpcResult,
  MetadataFetchLifecycleEvent,
  VideoFormat,
  VideoMetadata
} from '../../shared/types';

type RawYtDlpFormat = {
  format_id?: unknown;
  ext?: unknown;
  container?: unknown;
  resolution?: unknown;
  width?: unknown;
  height?: unknown;
  fps?: unknown;
  vcodec?: unknown;
  acodec?: unknown;
  abr?: unknown;
  filesize?: unknown;
  filesize_approx?: unknown;
  protocol?: unknown;
};

export type RawYtDlpMetadata = {
  _type?: unknown;
  entries?: unknown;
  extractor?: unknown;
  extractor_key?: unknown;
  webpage_url?: unknown;
  title?: unknown;
  thumbnail?: unknown;
  description?: unknown;
  uploader?: unknown;
  uploader_url?: unknown;
  channel?: unknown;
  channel_url?: unknown;
  creator_url?: unknown;
  artist_url?: unknown;
  duration?: unknown;
  formats?: unknown;
};

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function uniqueSortedStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function uniqueSortedNumbers(values: Array<number | undefined>): number[] {
  return Array.from(new Set(values.filter((value): value is number => value != null))).sort(
    (a, b) => a - b
  );
}

function toDisplayPlatform(value: string): string {
  const knownPlatforms: Record<string, string> = {
    youtube: 'YouTube',
    youtubetab: 'YouTube',
    youtubesearchurl: 'YouTube',
    youtu: 'YouTube',
    tiktok: 'TikTok',
    instagram: 'Instagram',
    twitter: 'X',
    x: 'X',
    vimeo: 'Vimeo',
    twitch: 'Twitch',
    facebook: 'Facebook',
    dailymotion: 'Dailymotion',
    reddit: 'Reddit',
    soundcloud: 'SoundCloud'
  };

  const normalized = value.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const known = knownPlatforms[normalized];

  if (known) {
    return known;
  }

  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getHostnamePlatform(inputUrl: string): string | undefined {
  try {
    const hostname = new URL(inputUrl).hostname.replace(/^www\./i, '');
    const [domain = ''] = hostname.split('.');
    return domain ? toDisplayPlatform(domain) : undefined;
  } catch {
    return undefined;
  }
}

function parsePlatform(url: string, raw: RawYtDlpMetadata): string | undefined {
  const extractor = asString(raw.extractor_key) ?? asString(raw.extractor);

  if (extractor && extractor.toLowerCase() !== 'generic') {
    return toDisplayPlatform(extractor);
  }

  return getHostnamePlatform(asString(raw.webpage_url) ?? url);
}

function parseFormats(rawFormats: unknown): VideoFormat[] {
  if (!Array.isArray(rawFormats)) {
    return [];
  }

  return rawFormats.map((raw, index) => {
    const format = raw as RawYtDlpFormat;
    return {
      id: asString(format.format_id) ?? String(index),
      extension: asString(format.ext) ?? 'unknown',
      container: asString(format.container),
      resolution: asString(format.resolution),
      width: asNumber(format.width),
      height: asNumber(format.height),
      fps: asNumber(format.fps),
      videoCodec: asString(format.vcodec),
      audioCodec: asString(format.acodec),
      audioBitrate: asNumber(format.abr),
      filesize: asNumber(format.filesize),
      filesizeApprox: asNumber(format.filesize_approx),
      protocol: asString(format.protocol)
    };
  });
}

export function parseMetadata(
  requestId: string,
  url: string,
  raw: RawYtDlpMetadata
): VideoMetadata {
  if (raw._type === 'playlist' || Array.isArray(raw.entries)) {
    throw new Error('Playlist and channel downloads are not available in this version.');
  }

  const formats = parseFormats(raw.formats);
  const videoFormats = formats.filter((format) => format.videoCodec !== 'none');

  return {
    requestId,
    url,
    webpageUrl: asString(raw.webpage_url),
    platform: parsePlatform(url, raw),
    title: asString(raw.title) ?? 'Untitled video',
    thumbnail: asString(raw.thumbnail),
    description: asString(raw.description),
    uploader: asString(raw.uploader) ?? asString(raw.channel),
    uploaderUrl:
      asString(raw.uploader_url) ??
      asString(raw.channel_url) ??
      asString(raw.creator_url) ??
      asString(raw.artist_url),
    duration: asNumber(raw.duration),
    maxResolution: Math.max(0, ...videoFormats.map((format) => format.height ?? 0)) || undefined,
    containers: uniqueSortedStrings(formats.map((format) => format.extension)),
    videoCodecs: uniqueSortedStrings(videoFormats.map((format) => format.videoCodec)),
    audioCodecs: uniqueSortedStrings(formats.map((format) => format.audioCodec)),
    fpsOptions: uniqueSortedNumbers(videoFormats.map((format) => format.fps)),
    formats
  };
}

function now(): string {
  return new Date().toISOString();
}

function broadcast(channel: string, payload: unknown): void {
  for (const contents of webContents.getAllWebContents()) {
    if (!contents.isDestroyed()) {
      contents.send(channel, payload);
    }
  }
}

export class VideoMetadataService {
  private readonly controllers = new Map<string, AbortController>();

  constructor(
    private readonly binaryService: BinaryService,
    private readonly logsDirectory: string = join(app.getPath('userData'), 'logs')
  ) {}

  cancel(requestId: string): void {
    this.controllers.get(requestId)?.abort();
    this.controllers.delete(requestId);
  }

  async fetch(
    requestId: string,
    inputUrl: string,
    settings: AppSettings
  ): Promise<IpcResult<VideoMetadata>> {
    const validation = validateUrl(inputUrl);
    if (!validation.isValid || !validation.normalized) {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: validation.reason ?? 'Invalid URL.' }
      };
    }

    const kind = classifyVideoUrl(validation.normalized);
    if (kind === 'playlist' || kind === 'channel') {
      return {
        ok: false,
        error: {
          code: 'UNSUPPORTED_URL',
          message: 'Only single-video links are supported in this version.'
        }
      };
    }

    const normalizedUrl = validation.normalized;
    const controller = new AbortController();
    this.controllers.set(requestId, controller);
    let logPath: string | null = null;
    let appendLog: ((chunk: string) => void) | null = null;
    let flushLog: (() => void) | null = null;
    let closeLog: (() => Promise<void>) | null = null;

    try {
      const binaries = this.binaryService.getPaths();
      mkdirSync(this.logsDirectory, { recursive: true });
      logPath = join(this.logsDirectory, `${requestId}.log`);
      const logStream = createWriteStream(logPath, { flags: 'a' });
      let pendingLogLine = '';
      const emitLogLines = (lines: string[]): void => {
        if (lines.length === 0 || !logPath) {
          return;
        }

        const append: DownloadLogAppend = {
          logPath,
          lines,
          timestamp: now()
        };

        broadcast(IPC_CHANNELS.logs.append, append);
      };
      appendLog = (chunk: string): void => {
        logStream.write(chunk);
        const parts = `${pendingLogLine}${chunk}`.split(/\r?\n|\r/);
        pendingLogLine = parts.pop() ?? '';
        emitLogLines(parts);
      };
      flushLog = (): void => {
        if (pendingLogLine.length > 0) {
          emitLogLines([pendingLogLine]);
          pendingLogLine = '';
        }
      };
      closeLog = async (): Promise<void> => {
        await new Promise<void>((resolve) => {
          logStream.end(() => resolve());
        });
      };

      const emitFetchLifecycle = (state: MetadataFetchLifecycleEvent['state']): void => {
        if (!logPath) {
          return;
        }

        const event: MetadataFetchLifecycleEvent = {
          requestId,
          url: normalizedUrl,
          logPath,
          state,
          timestamp: now()
        };

        broadcast(IPC_CHANNELS.video.fetchLifecycle, event);
      };

      appendLog(
        `[${now()}] Fetch started\nURL: ${normalizedUrl}\nLog: ${logPath}\n\n[${now()}] Stage: fetching_metadata\n[${now()}] Process: yt-dlp\n\n`
      );
      emitFetchLifecycle('started');
      const args = [
        '--ignore-config',
        '--no-js-runtimes',
        '--js-runtimes',
        `deno:${binaries.deno}`,
        '--dump-single-json',
        '--skip-download',
        '--no-playlist'
      ];

      if (settings.cookiesBrowser !== 'none') {
        args.push('--cookies-from-browser', settings.cookiesBrowser);
      }

      args.push(normalizedUrl);

      const result = await captureProcess(binaries.ytdlp, args, {
        signal: controller.signal,
        onStdout: appendLog,
        onStderr: appendLog
      });
      if (controller.signal.aborted) {
        appendLog(`\n[${now()}] Fetch cancelled.\n`);
        emitFetchLifecycle('cancelled');
        return { ok: false, error: { code: 'CANCELLED', message: 'Metadata request cancelled.' } };
      }

      if (result.exitCode !== 0) {
        appendLog(`\n[${now()}] Fetch failed with exit code ${result.exitCode}.\n`);
        emitFetchLifecycle('failed');
        return {
          ok: false,
          error: {
            code: 'UNSUPPORTED_URL',
            message: 'This URL is not supported.',
            details: result.stderr.trim()
          }
        };
      }

      const parsed = JSON.parse(result.stdout) as RawYtDlpMetadata;
      const metadata = parseMetadata(requestId, normalizedUrl, parsed);
      appendLog(`\n[${now()}] Fetch completed.\n`);
      emitFetchLifecycle('succeeded');
      return { ok: true, data: metadata };
    } catch (error) {
      if (controller.signal.aborted) {
        appendLog?.(`\n[${now()}] Fetch cancelled.\n`);
        if (logPath) {
          const event: MetadataFetchLifecycleEvent = {
            requestId,
            url: normalizedUrl,
            logPath,
            state: 'cancelled',
            timestamp: now()
          };
          broadcast(IPC_CHANNELS.video.fetchLifecycle, event);
        }
        return { ok: false, error: { code: 'CANCELLED', message: 'Metadata request cancelled.' } };
      }

      if (error instanceof BinaryMissingError) {
        return { ok: false, error: { code: 'BINARY_MISSING', message: error.message } };
      }

      appendLog?.(
        `\n[${now()}] Fetch failed\n${error instanceof Error ? error.message : String(error)}\n`
      );
      if (logPath) {
        const event: MetadataFetchLifecycleEvent = {
          requestId,
          url: normalizedUrl,
          logPath,
          state: 'failed',
          timestamp: now()
        };
        broadcast(IPC_CHANNELS.video.fetchLifecycle, event);
      }
      return {
        ok: false,
        error: {
          code: 'PROCESS_FAILED',
          message: error instanceof Error ? error.message : String(error)
        }
      };
    } finally {
      this.controllers.delete(requestId);
      flushLog?.();
      await closeLog?.();
    }
  }
}
