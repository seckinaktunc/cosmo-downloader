import { describe, expect, it } from 'vitest';
import {
  buildOutputPath,
  getEditableSavePathParts,
  getEffectiveSavePath,
  getOutputDirectory,
  getStoredSavePathParts,
  resetOutputBasename,
  replaceOutputBasename,
  replaceOutputExtension,
  sanitizeOutputFilename
} from '@renderer/lib/outputPath';

describe('replaceOutputExtension', () => {
  it('updates a Windows path extension', () => {
    expect(replaceOutputExtension('C:\\Downloads\\video.webm', 'mp4')).toBe(
      'C:\\Downloads\\video.mp4'
    );
  });

  it('adds an extension when the path has none', () => {
    expect(replaceOutputExtension('/home/user/video', 'mkv')).toBe('/home/user/video.mkv');
  });

  it('keeps the new basename when changing only the extension', () => {
    expect(replaceOutputExtension('C:\\Downloads\\New Video.mp4', 'webm')).toBe(
      'C:\\Downloads\\New Video.webm'
    );
  });

  it('replaces only the basename while preserving directory and extension', () => {
    expect(replaceOutputBasename('C:\\Downloads\\Old Video.mp4', 'New Video')).toBe(
      'C:\\Downloads\\New Video.mp4'
    );
    expect(replaceOutputBasename('/Users/me/Downloads/Old Video.webm', 'New Video')).toBe(
      '/Users/me/Downloads/New Video.webm'
    );
  });

  it('resets the basename to the sanitized fetched title while preserving directory and extension', () => {
    expect(resetOutputBasename('C:\\Downloads\\Custom Name.mp4', 'New: Video? <Final>.')).toBe(
      'C:\\Downloads\\New Video Final.mp4'
    );
  });
});

describe('output path helpers', () => {
  it('extracts Windows and POSIX directories', () => {
    expect(getOutputDirectory('C:\\Downloads\\Old Video.mp4')).toBe('C:\\Downloads');
    expect(getOutputDirectory('/Users/me/Downloads/Old.webm')).toBe('/Users/me/Downloads');
  });

  it('builds an output path with the provided directory and title', () => {
    expect(buildOutputPath('C:\\Downloads', 'New Video', 'mp4')).toBe(
      'C:\\Downloads\\New Video.mp4'
    );
    expect(buildOutputPath('/Users/me/Downloads', 'New Video', 'mkv')).toBe(
      '/Users/me/Downloads/New Video.mkv'
    );
  });

  it('sanitizes illegal filename characters', () => {
    expect(sanitizeOutputFilename('New: Video? <Final>.')).toBe('New Video Final');
  });

  it('returns the original path with current extension when folder-per-download is disabled', () => {
    expect(getEffectiveSavePath('C:\\Downloads\\myVideo1.webm', 'mp4', false)).toBe(
      'C:\\Downloads\\myVideo1.mp4'
    );
  });

  it('displays the nested Windows folder-per-download path', () => {
    expect(getEffectiveSavePath('C:\\Downloads\\myVideo1.mp4', 'mp4', true)).toBe(
      'C:\\Downloads\\myVideo1\\myVideo1.mp4'
    );
  });

  it('displays the nested POSIX folder-per-download path', () => {
    expect(getEffectiveSavePath('/Users/me/Downloads/myVideo1.mp4', 'mp4', true)).toBe(
      '/Users/me/Downloads/myVideo1/myVideo1.mp4'
    );
  });

  it('sanitizes the displayed folder and file name', () => {
    expect(getEffectiveSavePath('C:\\Downloads\\my:Video?.mp4', 'mp4', true)).toBe(
      'C:\\Downloads\\my Video\\my Video.mp4'
    );
  });

  it('handles paths without a directory', () => {
    expect(getEffectiveSavePath('myVideo1.mp4', 'mp4', true)).toBe('myVideo1/myVideo1.mp4');
  });

  it('derives editable save path parts for a normal file path', () => {
    expect(getEditableSavePathParts('/Users/me/Downloads/myVideo1.webm', 'mp4', false)).toEqual({
      leadingPath: '/Users/me/Downloads/',
      basename: 'myVideo1',
      trailingSuffix: '.mp4'
    });
  });

  it('derives editable save path parts for folder-per-download paths', () => {
    expect(getEditableSavePathParts('/Users/me/Downloads/myVideo1.mp4', 'mp4', true)).toEqual({
      leadingPath: '/Users/me/Downloads/myVideo1/',
      basename: 'myVideo1',
      trailingSuffix: '.mp4'
    });
  });

  it('derives stored save path parts without folder-per-download expansion', () => {
    expect(getStoredSavePathParts('/Users/me/Downloads/myVideo1.mp4')).toEqual({
      leadingPath: '/Users/me/Downloads/',
      basename: 'myVideo1',
      trailingSuffix: '.mp4'
    });
  });
});
