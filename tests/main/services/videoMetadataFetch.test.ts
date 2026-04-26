import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IPC_CHANNELS } from '@shared/ipc';
import type { AppSettings } from '@shared/types';
import { VideoMetadataService } from '@main/services/videoMetadataService';
import { captureProcess } from '@main/utils/process';

const send = vi.fn();

vi.mock('electron', () => ({
  app: {
    getPath: () => ''
  },
  webContents: {
    getAllWebContents: () => [
      {
        isDestroyed: () => false,
        send
      }
    ]
  }
}));

vi.mock('@main/utils/process', () => ({
  captureProcess: vi.fn()
}));

const settings: AppSettings = {
  hardwareAcceleration: true,
  automaticUpdates: true,
  alwaysAskDownloadLocation: false,
  createFolderPerDownload: false,
  defaultDownloadLocation: '/downloads',
  interfaceLanguage: 'en_US',
  cookiesBrowser: 'none',
  alwaysOnTop: false
};

const tempDirs: string[] = [];

afterEach(() => {
  send.mockReset();
  vi.clearAllMocks();
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe('VideoMetadataService fetch logging', () => {
  it('writes successful fetch logs and emits lifecycle events', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-fetch-'));
    tempDirs.push(directory);
    vi.mocked(captureProcess).mockImplementationOnce(async (_command, _args, options) => {
      options?.onStderr?.('[youtube] Downloading webpage\n');
      options?.onStdout?.('{"title":"Video","formats":[]}\n');
      return {
        stdout: '{"title":"Video","formats":[]}',
        stderr: '[youtube] Downloading webpage\n',
        exitCode: 0
      };
    });

    const service = new VideoMetadataService(
      {
        getPaths: () => ({ ytdlp: '/bin/yt-dlp' })
      } as never,
      directory
    );

    const result = await service.fetch('request-1', 'https://example.com/video', settings);

    expect(result.ok).toBe(true);
    const logPath = join(directory, 'request-1.log');
    const logContent = readFileSync(logPath, 'utf8');
    expect(logContent).toContain('Fetch started');
    expect(logContent).toContain('https://example.com/video');
    expect(logContent).toContain('[youtube] Downloading webpage');
    expect(logContent).toContain('"title":"Video"');
    expect(send).toHaveBeenCalledWith(
      IPC_CHANNELS.video.fetchLifecycle,
      expect.objectContaining({ requestId: 'request-1', state: 'started', logPath })
    );
    expect(send).toHaveBeenCalledWith(
      IPC_CHANNELS.video.fetchLifecycle,
      expect.objectContaining({ requestId: 'request-1', state: 'succeeded', logPath })
    );
    expect(send).toHaveBeenCalledWith(
      IPC_CHANNELS.logs.append,
      expect.objectContaining({ logPath })
    );
  });

  it('writes failed fetch logs and returns the extractor stderr in details', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'cosmo-fetch-'));
    tempDirs.push(directory);
    vi.mocked(captureProcess).mockImplementationOnce(async (_command, _args, options) => {
      options?.onStderr?.("ERROR: Sign in to confirm you're not a bot.\n");
      return {
        stdout: '',
        stderr: "ERROR: Sign in to confirm you're not a bot.\n",
        exitCode: 1
      };
    });

    const service = new VideoMetadataService(
      {
        getPaths: () => ({ ytdlp: '/bin/yt-dlp' })
      } as never,
      directory
    );

    const result = await service.fetch('request-2', 'https://example.com/video', settings);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected fetch to fail.');
    }

    const logPath = join(directory, 'request-2.log');
    const logContent = readFileSync(logPath, 'utf8');
    expect(logContent).toContain('Fetch failed with exit code 1');
    expect(logContent).toContain('not a bot');
    expect(result.error.details).toBe("ERROR: Sign in to confirm you're not a bot.");
    expect(send).toHaveBeenCalledWith(
      IPC_CHANNELS.video.fetchLifecycle,
      expect.objectContaining({ requestId: 'request-2', state: 'failed', logPath })
    );
  });
});
