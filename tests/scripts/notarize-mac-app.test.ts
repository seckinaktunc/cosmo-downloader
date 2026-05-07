import { describe, expect, it, vi } from 'vitest';
import {
  getNotaryInfoArgs,
  getNotarySubmitArgs,
  notarizeMacApp
} from '../../scripts/notarize-mac-app.mjs';

const apiKeyEnv = {
  APPLE_API_KEY: '/tmp/AuthKey_TEST123456.p8',
  APPLE_API_KEY_ID: 'TEST123456',
  APPLE_API_ISSUER: 'issuer-id'
};

describe('getNotarySubmitArgs', () => {
  it('uses App Store Connect API key credentials when available', () => {
    expect(getNotarySubmitArgs('/tmp/Cosmo Downloader.zip', apiKeyEnv)).toEqual([
      'notarytool',
      'submit',
      '/tmp/Cosmo Downloader.zip',
      '--key',
      '/tmp/AuthKey_TEST123456.p8',
      '--key-id',
      'TEST123456',
      '--issuer',
      'issuer-id',
      '--output-format',
      'json'
    ]);
  });

  it('builds the notary info lookup command for polling', () => {
    expect(getNotaryInfoArgs('submission-id', apiKeyEnv)).toEqual([
      'notarytool',
      'info',
      'submission-id',
      '--key',
      '/tmp/AuthKey_TEST123456.p8',
      '--key-id',
      'TEST123456',
      '--issuer',
      'issuer-id',
      '--output-format',
      'json'
    ]);
  });
});

describe('notarizeMacApp', () => {
  it('submits, polls, and staples an accepted app', async () => {
    const commandRunner = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({ stdout: JSON.stringify({ id: 'submission-id' }), stderr: '' })
      .mockResolvedValueOnce({ stdout: JSON.stringify({ status: 'In Progress' }), stderr: '' })
      .mockResolvedValueOnce({ stdout: JSON.stringify({ status: 'Accepted' }), stderr: '' })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });
    const delay = vi.fn(async () => {});
    const removeTempDir = vi.fn(async () => {});

    await expect(
      notarizeMacApp({
        appPath: '/tmp/Cosmo Downloader.app',
        env: apiKeyEnv,
        platform: 'darwin',
        pollIntervalMs: 1,
        timeoutMs: 10_000,
        commandRunner,
        delay,
        createTempDir: async () => '/tmp/notary-temp',
        removeTempDir
      })
    ).resolves.toBeUndefined();

    expect(commandRunner).toHaveBeenNthCalledWith(
      1,
      'ditto',
      expect.arrayContaining(['--keepParent', 'Cosmo Downloader.app']),
      expect.objectContaining({ cwd: '/tmp' })
    );
    expect(commandRunner).toHaveBeenNthCalledWith(
      2,
      'xcrun',
      expect.arrayContaining(['notarytool', 'submit']),
      expect.any(Object)
    );
    expect(commandRunner).toHaveBeenNthCalledWith(
      5,
      'xcrun',
      expect.arrayContaining(['stapler', 'staple', '-v', '/tmp/Cosmo Downloader.app']),
      expect.any(Object)
    );
    expect(delay).toHaveBeenCalledTimes(1);
    expect(removeTempDir).toHaveBeenCalledWith('/tmp/notary-temp');
  });

  it('downloads the Apple log when notarization becomes invalid', async () => {
    const commandRunner = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({ stdout: JSON.stringify({ id: 'submission-id' }), stderr: '' })
      .mockResolvedValueOnce({ stdout: JSON.stringify({ status: 'Invalid' }), stderr: '' })
      .mockResolvedValueOnce({ stdout: '{"issues":[{"message":"Bad signature"}]}', stderr: '' });

    await expect(
      notarizeMacApp({
        appPath: '/tmp/Cosmo Downloader.app',
        env: apiKeyEnv,
        platform: 'darwin',
        pollIntervalMs: 1,
        timeoutMs: 10_000,
        commandRunner,
        delay: async () => {},
        createTempDir: async () => '/tmp/notary-temp',
        removeTempDir: async () => {}
      })
    ).rejects.toThrow('Bad signature');

    expect(commandRunner).toHaveBeenNthCalledWith(
      4,
      'xcrun',
      expect.arrayContaining(['notarytool', 'log', 'submission-id']),
      expect.any(Object)
    );
  });

  it('fails when Apple never returns an accepted status before the timeout', async () => {
    const originalNow = Date.now;
    let fakeNow = 0;
    Date.now = () => fakeNow;

    const commandRunner = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '', stderr: '' })
      .mockResolvedValueOnce({ stdout: JSON.stringify({ id: 'submission-id' }), stderr: '' })
      .mockResolvedValue({ stdout: JSON.stringify({ status: 'In Progress' }), stderr: '' });

    try {
      await expect(
        notarizeMacApp({
          appPath: '/tmp/Cosmo Downloader.app',
          env: apiKeyEnv,
          platform: 'darwin',
          pollIntervalMs: 1,
          timeoutMs: 50,
          commandRunner,
          delay: async () => {
            fakeNow += 60;
          },
          createTempDir: async () => '/tmp/notary-temp',
          removeTempDir: async () => {}
        })
      ).rejects.toThrow('Timed out waiting for Apple notarization');
    } finally {
      Date.now = originalNow;
    }
  });
});
