import { describe, expect, it, vi } from 'vitest';
import {
  buildReleaseConflictSummary,
  getGitCommitInvocation,
  getGitHubToken,
  getGitTagInvocation,
  getNpmVersionInvocation,
  incrementPatchVersion,
  normalizePackageVersion,
  parseGitHubRepoFromRemote,
  resolveReleaseTargetVersion,
  runReleasePublic
} from '../../scripts/release-public.mjs';

describe('parseGitHubRepoFromRemote', () => {
  it('parses https remotes', () => {
    expect(
      parseGitHubRepoFromRemote('https://github.com/seckinaktunc/cosmo-downloader.git')
    ).toEqual(
      expect.objectContaining({
        host: 'github.com',
        owner: 'seckinaktunc',
        repo: 'cosmo-downloader',
        apiBaseUrl: 'https://api.github.com'
      })
    );
  });

  it('parses ssh remotes', () => {
    expect(parseGitHubRepoFromRemote('git@github.com:seckinaktunc/cosmo-downloader.git')).toEqual(
      expect.objectContaining({
        owner: 'seckinaktunc',
        repo: 'cosmo-downloader'
      })
    );
  });
});

describe('version helpers', () => {
  it('normalizes package versions without the v prefix', () => {
    expect(normalizePackageVersion('v1.0.6')).toBe('1.0.6');
    expect(normalizePackageVersion('1.0.6')).toBe('1.0.6');
  });

  it('increments the patch component', () => {
    expect(incrementPatchVersion('1.0.6')).toBe('1.0.7');
  });
});

describe('getGitHubToken', () => {
  it('prefers GH_TOKEN over GITHUB_TOKEN', () => {
    expect(
      getGitHubToken({
        GH_TOKEN: 'preferred-token',
        GITHUB_TOKEN: 'fallback-token'
      })
    ).toBe('preferred-token');
  });
});

describe('buildReleaseConflictSummary', () => {
  it('lists the active conflict sources', () => {
    expect(
      buildReleaseConflictSummary({
        release: { id: 1 },
        remoteTag: { ref: 'refs/tags/v1.0.6' },
        localTag: true
      })
    ).toBe('GitHub release, remote tag, local tag');
  });
});

describe('resolveReleaseTargetVersion', () => {
  const changelog = `# Changelog

## v1.0.7

### Added

- Next patch.

## v1.0.6

### Added

- Current release.
`;

  it('keeps the requested version when there is no conflict', async () => {
    await expect(
      resolveReleaseTargetVersion({
        initialVersion: '1.0.6',
        changelogContents: changelog,
        checkConflict: vi.fn(async () => ({
          release: null,
          remoteTag: null,
          localTag: false
        })),
        deleteConflict: vi.fn(),
        promptChoice: vi.fn()
      })
    ).resolves.toEqual({
      version: '1.0.6',
      tag: 'v1.0.6'
    });
  });

  it('increments to the next patch version after a conflict', async () => {
    const checkConflict = vi.fn(async ({ version }) => {
      if (version === '1.0.6') {
        return {
          release: { id: 1 },
          remoteTag: null,
          localTag: false
        };
      }

      return {
        release: null,
        remoteTag: null,
        localTag: false
      };
    });

    await expect(
      resolveReleaseTargetVersion({
        initialVersion: '1.0.6',
        changelogContents: changelog,
        checkConflict,
        deleteConflict: vi.fn(),
        promptChoice: vi.fn(async () => 'increment')
      })
    ).resolves.toEqual({
      version: '1.0.7',
      tag: 'v1.0.7'
    });

    expect(checkConflict).toHaveBeenCalledTimes(2);
  });

  it('treats a remote tag without a release as a conflict', async () => {
    await expect(
      resolveReleaseTargetVersion({
        initialVersion: '1.0.6',
        changelogContents: changelog,
        checkConflict: vi.fn(async ({ version }) => ({
          release: null,
          remoteTag: version === '1.0.6' ? { ref: 'refs/tags/v1.0.6' } : null,
          localTag: false
        })),
        deleteConflict: vi.fn(),
        promptChoice: vi.fn(async () => 'increment')
      })
    ).resolves.toEqual({
      version: '1.0.7',
      tag: 'v1.0.7'
    });
  });

  it('deletes the conflicting release state when replacing', async () => {
    const deleteConflict = vi.fn();

    await expect(
      resolveReleaseTargetVersion({
        initialVersion: '1.0.6',
        changelogContents: changelog,
        checkConflict: vi.fn(async () => ({
          release: { id: 1 },
          remoteTag: { ref: 'refs/tags/v1.0.6' },
          localTag: true
        })),
        deleteConflict,
        promptChoice: vi.fn(async () => 'replace')
      })
    ).resolves.toEqual({
      version: '1.0.6',
      tag: 'v1.0.6'
    });

    expect(deleteConflict).toHaveBeenCalledWith({
      version: '1.0.6',
      tag: 'v1.0.6',
      conflict: {
        release: { id: 1 },
        remoteTag: { ref: 'refs/tags/v1.0.6' },
        localTag: true
      }
    });
  });

  it('fails when the chosen version is missing from the changelog', async () => {
    await expect(
      resolveReleaseTargetVersion({
        initialVersion: '1.0.8',
        changelogContents: changelog,
        checkConflict: vi.fn(),
        deleteConflict: vi.fn(),
        promptChoice: vi.fn()
      })
    ).rejects.toThrow('No changelog section found');
  });
});

describe('release command builders', () => {
  it('builds npm version without creating a git tag', () => {
    expect(getNpmVersionInvocation('1.0.7', {}, 'darwin')).toEqual({
      command: 'npm',
      args: ['version', '1.0.7', '--no-git-tag-version'],
      shell: false
    });
  });

  it('builds deterministic release commit and tag messages', () => {
    expect(getGitCommitInvocation('v1.0.7').args).toEqual(['commit', '-m', 'release: v1.0.7']);
    expect(getGitTagInvocation('v1.0.7').args).toEqual([
      'tag',
      '-a',
      'v1.0.7',
      '-m',
      'Release v1.0.7'
    ]);
  });
});

describe('runReleasePublic', () => {
  const packageJsonPath = '/repo/package.json';
  const packageLockPath = '/repo/package-lock.json';
  const changelogPath = '/repo/docs/CHANGELOG.md';

  function getExecOutputStub(overrides: Record<string, string>): ReturnType<typeof vi.fn> {
    return vi.fn(async (_command: string, args: string[]) => {
      const key = args.join(' ');
      if (key in overrides) {
        return overrides[key];
      }

      return '';
    });
  }

  it('fails outside the main branch before mutating anything', async () => {
    const runImpl = vi.fn();

    await expect(
      runReleasePublic({
        cwd: '/repo',
        env: { GH_TOKEN: 'token' },
        packageJsonPath,
        packageLockPath,
        changelogPath,
        readFile: vi.fn(),
        execOutputImpl: getExecOutputStub({
          'branch --show-current': 'feature-branch\n'
        }),
        runImpl
      })
    ).rejects.toThrow('must run from main');

    expect(runImpl).not.toHaveBeenCalled();
  });

  it('fails when no GitHub token is available', async () => {
    await expect(
      runReleasePublic({
        cwd: '/repo',
        env: {},
        packageJsonPath,
        packageLockPath,
        changelogPath
      })
    ).rejects.toThrow('Set GH_TOKEN or GITHUB_TOKEN');
  });

  it('fails when the worktree is dirty', async () => {
    const runImpl = vi.fn();

    await expect(
      runReleasePublic({
        cwd: '/repo',
        env: { GH_TOKEN: 'token' },
        packageJsonPath,
        packageLockPath,
        changelogPath,
        readFile: vi.fn(),
        execOutputImpl: getExecOutputStub({
          'branch --show-current': 'main\n',
          'status --porcelain': ' M package.json\n'
        }),
        runImpl
      })
    ).rejects.toThrow('clean git worktree');

    expect(runImpl).not.toHaveBeenCalled();
  });

  it('fails when local main is not synced with origin/main', async () => {
    const runImpl = vi.fn(async () => undefined);

    await expect(
      runReleasePublic({
        cwd: '/repo',
        env: { GH_TOKEN: 'token' },
        packageJsonPath,
        packageLockPath,
        changelogPath,
        readFile: vi.fn(),
        execOutputImpl: getExecOutputStub({
          'branch --show-current': 'main\n',
          'status --porcelain': '',
          'rev-parse main': 'abc123\n',
          'rev-parse origin/main': 'def456\n',
          'remote get-url origin': 'https://github.com/seckinaktunc/cosmo-downloader.git\n'
        }),
        runImpl
      })
    ).rejects.toThrow('must match origin/main');

    expect(runImpl).toHaveBeenCalledTimes(1);
  });

  it('auto-commits the bumped version and pushes the release tag', async () => {
    const runImpl = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/releases/tags/v1.0.6')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 42 })
        };
      }

      return {
        ok: false,
        status: 404
      };
    });

    const result = await runReleasePublic({
      cwd: '/repo',
      env: { GH_TOKEN: 'token' },
      platform: 'darwin',
      packageJsonPath,
      packageLockPath,
      changelogPath,
      readFile: vi.fn((filePath: string) => {
        if (filePath === packageJsonPath) {
          return JSON.stringify({ version: '1.0.6' });
        }

        if (filePath === changelogPath) {
          return `# Changelog

## v1.0.7

### Added

- Next release.

## v1.0.6

### Added

- Current release.
`;
        }

        throw new Error(`Unexpected read: ${filePath}`);
      }),
      pathExists: vi.fn((filePath: string) => filePath === packageLockPath),
      execOutputImpl: getExecOutputStub({
        'branch --show-current': 'main\n',
        'status --porcelain': '',
        'rev-parse main': 'abc123\n',
        'rev-parse origin/main': 'abc123\n',
        'remote get-url origin': 'https://github.com/seckinaktunc/cosmo-downloader.git\n',
        'rev-parse --verify --quiet refs/tags/v1.0.6': '',
        'rev-parse --verify --quiet refs/tags/v1.0.7': ''
      }),
      runImpl,
      fetchImpl,
      promptChoice: vi.fn(async () => 'increment'),
      logger: {
        log: vi.fn()
      }
    });

    expect(result).toEqual({
      version: '1.0.7',
      tag: 'v1.0.7'
    });

    expect(runImpl).toHaveBeenNthCalledWith(1, 'git', ['fetch', 'origin', 'main'], {
      cwd: '/repo',
      env: { GH_TOKEN: 'token' },
      shell: false
    });
    expect(runImpl).toHaveBeenNthCalledWith(
      2,
      'npm',
      ['version', '1.0.7', '--no-git-tag-version'],
      expect.objectContaining({
        cwd: '/repo'
      })
    );
    expect(runImpl).toHaveBeenNthCalledWith(
      3,
      'git',
      ['add', '--', 'package.json', 'package-lock.json'],
      expect.any(Object)
    );
    expect(runImpl).toHaveBeenNthCalledWith(
      4,
      'git',
      ['commit', '-m', 'release: v1.0.7'],
      expect.any(Object)
    );
    expect(runImpl).toHaveBeenNthCalledWith(
      5,
      'git',
      ['tag', '-a', 'v1.0.7', '-m', 'Release v1.0.7'],
      expect.any(Object)
    );
    expect(runImpl).toHaveBeenNthCalledWith(
      6,
      'git',
      ['push', 'origin', 'main'],
      expect.any(Object)
    );
    expect(runImpl).toHaveBeenNthCalledWith(
      7,
      'git',
      ['push', 'origin', 'v1.0.7'],
      expect.any(Object)
    );
  });
});
