import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, normalize } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EXPORT_SETTINGS } from '@shared/defaults';
import type { AppSettings, DownloadStartRequest, VideoMetadata } from '@shared/types';
import {
  buildFfmpegStreamCopyTrimArgs,
  buildFfmpegTranscodeArgs,
  buildYtDlpArgs,
  createFinalDestinationPath,
  getFfmpegTrimRange,
  shouldTranscodeAfterSourceProbe
} from '@main/services/downloadService';
import { createDownloadPlan } from '@main/services/formatPlanner';

vi.mock('electron', () => ({
  app: {
    getPath: () => ''
  },
  dialog: {
    showSaveDialog: vi.fn()
  },
  Notification: {
    isSupported: () => false
  },
  webContents: {
    getAllWebContents: () => []
  }
}));

const settings: AppSettings = {
  hardwareAcceleration: false,
  automaticUpdates: true,
  alwaysAskDownloadLocation: false,
  createFolderPerDownload: false,
  defaultDownloadLocation: '/downloads',
  interfaceLanguage: 'en_US',
  cookiesBrowser: 'none',
  alwaysOnTop: false
};

const metadata: VideoMetadata = {
  requestId: 'request',
  url: 'https://example.com/video',
  title: 'Video',
  duration: 120,
  containers: [],
  videoCodecs: [],
  audioCodecs: [],
  fpsOptions: [],
  formats: []
};

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

function createTempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'cosmo-download-'));
  tempDirs.push(directory);
  return directory;
}

function request(
  update: Partial<DownloadStartRequest['exportSettings']>,
  metadataUpdate: Partial<VideoMetadata> = {}
): DownloadStartRequest {
  return {
    metadata: { ...metadata, ...metadataUpdate },
    settings,
    exportSettings: {
      ...DEFAULT_EXPORT_SETTINGS,
      ...update
    }
  };
}

describe('buildFfmpegTranscodeArgs', () => {
  it('adds video bitrate for video outputs', () => {
    const args = buildFfmpegTranscodeArgs(request({ videoBitrate: 8 }), 'input.mkv', 'output.mp4');

    expect(args).toContain('-b:v');
    expect(args).toContain('8M');
  });

  it('omits video bitrate for audio-only outputs', () => {
    const args = buildFfmpegTranscodeArgs(
      request({ outputFormat: 'mp3', videoBitrate: 8 }),
      'input.mkv',
      'output.mp3'
    );

    expect(args).not.toContain('-b:v');
    expect(args).not.toContain('8M');
  });

  it('adds trim args while preserving transcode export settings', () => {
    const trimmedRequest = request({
      trimStartSeconds: 10,
      trimEndSeconds: 30,
      videoCodec: 'h265',
      videoBitrate: 8,
      frameRate: 30
    });
    const trimRange = getFfmpegTrimRange(trimmedRequest);
    const args = buildFfmpegTranscodeArgs(trimmedRequest, 'input.mkv', 'output.mp4', trimRange);

    expect(args).toEqual(expect.arrayContaining(['-ss', '0:10', '-t', '0:20']));
    expect(args).toEqual(expect.arrayContaining(['-c:v', 'libx265', '-b:v', '8M', '-r', '30']));
  });

  it('omits trim args when duration is unavailable', () => {
    const trimmedRequest = request(
      { trimStartSeconds: 10, trimEndSeconds: 30 },
      { duration: undefined }
    );
    const trimRange = getFfmpegTrimRange(trimmedRequest);
    const args = buildFfmpegTranscodeArgs(trimmedRequest, 'input.mkv', 'output.mp4', trimRange);

    expect(trimRange).toBeNull();
    expect(args).not.toContain('-ss');
    expect(args).not.toContain('-t');
  });

  it('uses the ProRes encoder for explicit ProRes MOV output', () => {
    const args = buildFfmpegTranscodeArgs(
      request({ outputFormat: 'mov', videoCodec: 'prores' }),
      'input.mkv',
      'output.mov'
    );

    expect(args).toEqual(expect.arrayContaining(['-c:v', 'prores_ks']));
  });
});

describe('buildFfmpegStreamCopyTrimArgs', () => {
  it('uses stream copy for direct/remux trimmed downloads', () => {
    const trimmedRequest = request({ trimStartSeconds: 5, trimEndSeconds: 15 });
    const trimRange = getFfmpegTrimRange(trimmedRequest);

    expect(trimRange).not.toBeNull();
    if (!trimRange) {
      throw new Error('Expected active trim range');
    }

    const args = buildFfmpegStreamCopyTrimArgs(
      trimmedRequest,
      'input.mkv',
      'output.mp4',
      trimRange
    );

    expect(args).toEqual(expect.arrayContaining(['-ss', '0:05', '-t', '0:10']));
    expect(args).toEqual(expect.arrayContaining(['-c', 'copy']));
    expect(args).toContain('output.mp4');
  });
});

describe('buildYtDlpArgs', () => {
  it('does not add download sections for trimmed video output', () => {
    const trimmedRequest = request({ trimStartSeconds: 10, trimEndSeconds: 30 });
    const args = buildYtDlpArgs({
      tempDir: '/tmp/cosmo',
      ffmpegDirectory: '/bin',
      request: trimmedRequest,
      plan: createDownloadPlan(trimmedRequest.metadata, trimmedRequest.exportSettings)
    });

    expect(args).not.toContain('--download-sections');
    expect(args).not.toContain('*0:10-0:30');
    expect(args[0]).toBe('--ignore-config');
  });

  it('omits download sections when trim covers the full duration', () => {
    const untrimmedRequest = request({ trimStartSeconds: 0, trimEndSeconds: 120 });
    const args = buildYtDlpArgs({
      tempDir: '/tmp/cosmo',
      ffmpegDirectory: '/bin',
      request: untrimmedRequest,
      plan: createDownloadPlan(untrimmedRequest.metadata, untrimmedRequest.exportSettings)
    });

    expect(args).not.toContain('--download-sections');
  });

  it('keeps cookies and format args while ignoring external yt-dlp config', () => {
    const args = buildYtDlpArgs({
      tempDir: '/tmp/cosmo',
      ffmpegDirectory: '/bin',
      request: {
        ...request({}),
        settings: {
          ...settings,
          cookiesBrowser: 'chrome'
        }
      },
      plan: createDownloadPlan(metadata, DEFAULT_EXPORT_SETTINGS)
    });

    expect(args).toEqual(
      expect.arrayContaining([
        '--ignore-config',
        '--ffmpeg-location',
        '/bin',
        '-f',
        '--cookies-from-browser',
        'chrome',
        'https://example.com/video'
      ])
    );
  });

  it('does not add download sections for trimmed audio-only output', () => {
    const trimmedRequest = request({
      outputFormat: 'mp3',
      trimStartSeconds: 5,
      trimEndSeconds: 15
    });
    const args = buildYtDlpArgs({
      tempDir: '/tmp/cosmo',
      ffmpegDirectory: '/bin',
      request: trimmedRequest,
      plan: createDownloadPlan(trimmedRequest.metadata, trimmedRequest.exportSettings)
    });

    expect(args).not.toContain('--download-sections');
    expect(args).not.toContain('*0:05-0:15');
  });
});

describe('createFinalDestinationPath', () => {
  it('wraps an explicit Windows-style output filename in a same-named folder', () => {
    expect(createFinalDestinationPath('C:\\Downloads', 'myVideo1', 'mp4', true)).toBe(
      'C:\\Downloads\\myVideo1\\myVideo1.mp4'
    );
  });

  it('wraps a POSIX-style output filename in a same-named folder on POSIX-equivalent paths', () => {
    expect(createFinalDestinationPath('/Users/me/Downloads', 'myVideo1', 'mkv', true)).toBe(
      normalize('/Users/me/Downloads/myVideo1/myVideo1.mkv')
    );
  });

  it('uses the sanitized metadata title as folder and file name for default-location downloads', () => {
    const directory = createTempDirectory();

    expect(createFinalDestinationPath(directory, 'My: Video?', 'mp4', true)).toBe(
      join(directory, 'My Video', 'My Video.mp4')
    );
  });

  it('reuses an existing folder and uniques only the filename inside it', () => {
    const directory = createTempDirectory();
    const folder = join(directory, 'myVideo1');
    mkdirSync(folder);
    writeFileSync(join(folder, 'myVideo1.mp4'), 'existing');

    expect(createFinalDestinationPath(directory, 'myVideo1', 'mp4', true)).toBe(
      join(folder, 'myVideo1 (1).mp4')
    );
  });

  it('preserves current output behavior when folder-per-download is disabled', () => {
    const directory = createTempDirectory();

    expect(createFinalDestinationPath(directory, 'myVideo1', 'mp4', false)).toBe(
      join(directory, 'myVideo1.mp4')
    );
  });
});

describe('shouldTranscodeAfterSourceProbe', () => {
  it('keeps direct output when selected codecs already match the downloaded file', () => {
    expect(
      shouldTranscodeAfterSourceProbe(false, request({ videoCodec: 'h264', audioCodec: 'aac' }), {
        streams: [
          { codec_type: 'video', codec_name: 'h264' },
          { codec_type: 'audio', codec_name: 'aac' }
        ]
      })
    ).toBe(false);
  });

  it('switches to transcode when selected codecs do not match the downloaded file', () => {
    expect(
      shouldTranscodeAfterSourceProbe(false, request({ videoCodec: 'h264', audioCodec: 'aac' }), {
        streams: [
          { codec_type: 'video', codec_name: 'vp9' },
          { codec_type: 'audio', codec_name: 'opus' }
        ]
      })
    ).toBe(true);
  });

  it('does not require ffprobe-driven transcode when codecs are automatic', () => {
    expect(
      shouldTranscodeAfterSourceProbe(false, request({}), {
        streams: [
          { codec_type: 'video', codec_name: 'vp9' },
          { codec_type: 'audio', codec_name: 'opus' }
        ]
      })
    ).toBe(false);
  });

  it('preserves an existing transcode requirement', () => {
    expect(
      shouldTranscodeAfterSourceProbe(true, request({ videoCodec: 'h264' }), {
        streams: [{ codec_type: 'video', codec_name: 'h264' }]
      })
    ).toBe(true);
  });
});
