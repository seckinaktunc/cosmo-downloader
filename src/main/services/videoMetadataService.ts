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
  ScrubPreviewFragment,
  ScrubPreviewHeaders,
  ScrubPreviewStoryboard,
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
  format_note?: unknown;
  rows?: unknown;
  columns?: unknown;
  url?: unknown;
  fragments?: unknown;
  http_headers?: unknown;
};

type RawYtDlpFragment = {
  url?: unknown;
  duration?: unknown;
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

function asPositiveNumber(value: unknown): number | undefined {
  const number = asNumber(value);
  return number != null && number > 0 ? number : undefined;
}

function asPositiveInteger(value: unknown): number | undefined {
  const number = asPositiveNumber(value);
  return number != null ? Math.floor(number) : undefined;
}

function asStringRecord(value: unknown): ScrubPreviewHeaders | undefined {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => {
      const [key, rawValue] = entry;
      return key.trim().length > 0 && typeof rawValue === 'string' && rawValue.trim().length > 0;
    }
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
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

function createScrubPreviewFragment(
  url: string | undefined,
  durationSeconds: number | undefined,
  frameRate: number,
  maxFramesPerFragment: number
): ScrubPreviewFragment | null {
  if (!url || durationSeconds == null || durationSeconds <= 0) {
    return null;
  }

  const frameCount = Math.max(
    1,
    Math.min(maxFramesPerFragment, Math.round(durationSeconds * frameRate))
  );

  return {
    url,
    durationSeconds,
    frameCount
  };
}

function parseScrubPreview(
  rawFormats: unknown,
  duration: number | undefined
): ScrubPreviewStoryboard | undefined {
  if (!Array.isArray(rawFormats)) {
    return undefined;
  }

  const candidates = rawFormats
    .map((raw) => {
      const format = raw as RawYtDlpFormat;
      const formatNote = asString(format.format_note)?.toLowerCase();
      const protocol = asString(format.protocol)?.toLowerCase();
      const looksLikeStoryboard = formatNote === 'storyboard' || protocol === 'mhtml';
      if (!looksLikeStoryboard) {
        return undefined;
      }

      const tileWidth = asPositiveInteger(format.width);
      const tileHeight = asPositiveInteger(format.height);
      const rows = asPositiveInteger(format.rows);
      const columns = asPositiveInteger(format.columns);
      const frameRate = asPositiveNumber(format.fps);
      if (!tileWidth || !tileHeight || !rows || !columns || !frameRate) {
        return undefined;
      }

      const maxFramesPerFragment = rows * columns;
      const fallbackUrl = asString(format.url);
      const fallbackDuration = asPositiveNumber(duration);
      const fragments = Array.isArray(format.fragments)
        ? format.fragments
            .map((rawFragment) => {
              const fragment = rawFragment as RawYtDlpFragment;
              return createScrubPreviewFragment(
                asString(fragment.url),
                asPositiveNumber(fragment.duration),
                frameRate,
                maxFramesPerFragment
              );
            })
            .filter((fragment): fragment is ScrubPreviewFragment => fragment != null)
        : fallbackUrl && fallbackDuration
          ? [
              createScrubPreviewFragment(
                fallbackUrl,
                fallbackDuration,
                frameRate,
                maxFramesPerFragment
              )
            ].filter((fragment): fragment is ScrubPreviewFragment => fragment != null)
          : [];

      if (fragments.length === 0) {
        return undefined;
      }

      const headers = asStringRecord(format.http_headers);

      return headers == null
        ? {
            kind: 'storyboard' as const,
            tileWidth,
            tileHeight,
            columns,
            rows,
            frameRate,
            frameStepSeconds: 1 / frameRate,
            totalDurationSeconds: fragments.reduce(
              (sum, fragment) => sum + fragment.durationSeconds,
              0
            ),
            fragments
          }
        : {
            kind: 'storyboard' as const,
            tileWidth,
            tileHeight,
            columns,
            rows,
            frameRate,
            frameStepSeconds: 1 / frameRate,
            totalDurationSeconds: fragments.reduce(
              (sum, fragment) => sum + fragment.durationSeconds,
              0
            ),
            headers,
            fragments
          };
    })
    .filter((candidate): candidate is ScrubPreviewStoryboard => candidate != null)
    .sort((left, right) => {
      const leftArea = left.tileWidth * left.tileHeight;
      const rightArea = right.tileWidth * right.tileHeight;
      if (leftArea !== rightArea) {
        return rightArea - leftArea;
      }

      const leftGrid = left.columns * left.rows;
      const rightGrid = right.columns * right.rows;
      if (leftGrid !== rightGrid) {
        return rightGrid - leftGrid;
      }

      return right.fragments.length - left.fragments.length;
    });

  return candidates[0];
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
  const duration = asNumber(raw.duration);
  const scrubPreview = parseScrubPreview(raw.formats, duration);

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
    duration,
    scrubPreview,
    maxResolution: Math.max(0, ...videoFormats.map((format) => format.height ?? 0)) || undefined,
    containers: uniqueSortedStrings(formats.map((format) => format.extension)),
    videoCodecs: uniqueSortedStrings(videoFormats.map((format) => format.videoCodec)),
    audioCodecs: uniqueSortedStrings(formats.map((format) => format.audioCodec)),
    fpsOptions: uniqueSortedNumbers(videoFormats.map((format) => format.fps)),
    formats
  };
}

function getYtDlpJsRuntimeArg(denoPath: string): string {
  return `deno:${denoPath}`;
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
        getYtDlpJsRuntimeArg(binaries.deno),
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
