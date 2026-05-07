/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { execFile, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { createInterface } from 'readline/promises';
import { dirname, relative, resolve } from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { stdin as defaultInput, stdout as defaultOutput } from 'process';
import { extractReleaseNotes, normalizeReleaseVersion } from './extract-release-notes.mjs';

const execFileAsync = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const PACKAGE_JSON_PATH = resolve(projectRoot, 'package.json');
const PACKAGE_LOCK_PATH = resolve(projectRoot, 'package-lock.json');
const CHANGELOG_PATH = resolve(projectRoot, 'docs', 'CHANGELOG.md');
const GITHUB_API_VERSION = '2022-11-28';
const RELEASE_BRANCH = 'main';

export function getGitHubToken(env = process.env) {
  return env.GH_TOKEN?.trim() || env.GITHUB_TOKEN?.trim() || '';
}

export function normalizePackageVersion(version) {
  return normalizeReleaseVersion(version).replace(/^v/, '');
}

export function incrementPatchVersion(version) {
  const normalized = normalizePackageVersion(version);
  const parts = normalized.split('.').map((value) => Number.parseInt(value, 10));

  if (parts.length !== 3 || parts.some((value) => Number.isNaN(value) || value < 0)) {
    throw new Error(`Unsupported package version: ${version}`);
  }

  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

export function parseGitHubRepoFromRemote(remoteUrl) {
  const trimmed = String(remoteUrl ?? '').trim();

  if (!trimmed) {
    throw new Error('Git remote "origin" is not configured.');
  }

  let match =
    /^(?:git\+)?https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(trimmed) ||
    /^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/.exec(trimmed) ||
    /^ssh:\/\/git@([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(trimmed);

  if (!match) {
    throw new Error(`Unsupported GitHub remote URL: ${trimmed}`);
  }

  const [, host, owner, repo] = match;
  const apiBaseUrl = host === 'github.com' ? 'https://api.github.com' : `https://${host}/api/v3`;

  return {
    host,
    owner,
    repo,
    apiBaseUrl
  };
}

export function getNpmInvocation(args, env = process.env, platform = process.platform) {
  if (env.npm_execpath) {
    return {
      command: process.execPath,
      args: [env.npm_execpath, ...args],
      shell: false
    };
  }

  return {
    command: platform === 'win32' ? 'npm.cmd' : 'npm',
    args,
    shell: platform === 'win32'
  };
}

export function getNpmVersionInvocation(version, env = process.env, platform = process.platform) {
  return getNpmInvocation(['version', version, '--no-git-tag-version'], env, platform);
}

export function getGitInvocation(args) {
  return {
    command: 'git',
    args,
    shell: false
  };
}

export function getGitFetchInvocation(branch = RELEASE_BRANCH) {
  return getGitInvocation(['fetch', 'origin', branch]);
}

export function getGitAddInvocation(files) {
  return getGitInvocation(['add', '--', ...files]);
}

export function getGitCommitInvocation(tag) {
  return getGitInvocation(['commit', '-m', `release: ${tag}`]);
}

export function getGitTagInvocation(tag) {
  return getGitInvocation(['tag', '-a', tag, '-m', `Release ${tag}`]);
}

export function getGitPushBranchInvocation(branch = RELEASE_BRANCH) {
  return getGitInvocation(['push', 'origin', branch]);
}

export function getGitPushTagInvocation(tag) {
  return getGitInvocation(['push', 'origin', tag]);
}

export function getGitDeleteLocalTagInvocation(tag) {
  return getGitInvocation(['tag', '-d', tag]);
}

export function isGitWorktreeClean(statusOutput) {
  return String(statusOutput ?? '').trim() === '';
}

export function hasReleaseConflict(conflict) {
  return Boolean(conflict?.release || conflict?.remoteTag || conflict?.localTag);
}

export function buildReleaseConflictSummary(conflict) {
  const parts = [];

  if (conflict?.release) {
    parts.push('GitHub release');
  }

  if (conflict?.remoteTag) {
    parts.push('remote tag');
  }

  if (conflict?.localTag) {
    parts.push('local tag');
  }

  return parts.length > 0 ? parts.join(', ') : 'existing release state';
}

export function validateChangelogForVersion(version, changelogContents) {
  extractReleaseNotes(changelogContents, version);
  return true;
}

export async function execOutput(
  command,
  args,
  { cwd = projectRoot, env = process.env, execFileImpl = execFileAsync } = {}
) {
  const result = await execFileImpl(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    shell: false
  });

  return String(result.stdout ?? '');
}

export function run(command, args, { cwd = projectRoot, env = process.env, shell = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd,
      env,
      shell
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

export async function gitLocalTagExists(
  tag,
  { cwd = projectRoot, env = process.env, execOutputImpl = execOutput } = {}
) {
  try {
    const output = await execOutputImpl(
      'git',
      ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`],
      { cwd, env }
    );
    return Boolean(output.trim());
  } catch {
    return false;
  }
}

export async function requestGitHub(
  path,
  { apiBaseUrl = 'https://api.github.com', token, method = 'GET', fetchImpl = fetch, body }
) {
  const response = await fetchImpl(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION
    },
    body: body == null ? undefined : JSON.stringify(body)
  });

  if (response.status === 404) {
    return {
      notFound: true,
      data: null
    };
  }

  if (!response.ok) {
    throw new Error(`GitHub API ${method} ${path} failed with ${response.status}.`);
  }

  if (response.status === 204) {
    return {
      notFound: false,
      data: null
    };
  }

  return {
    notFound: false,
    data: await response.json()
  };
}

export async function getGitHubReleaseByTag({
  owner,
  repo,
  tag,
  token,
  apiBaseUrl,
  fetchImpl = fetch
}) {
  const response = await requestGitHub(
    `/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`,
    {
      apiBaseUrl,
      token,
      fetchImpl
    }
  );

  return response.notFound ? null : response.data;
}

export async function getGitHubTagRef({ owner, repo, tag, token, apiBaseUrl, fetchImpl = fetch }) {
  const response = await requestGitHub(
    `/repos/${owner}/${repo}/git/ref/tags/${encodeURIComponent(tag)}`,
    {
      apiBaseUrl,
      token,
      fetchImpl
    }
  );

  return response.notFound ? null : response.data;
}

export async function deleteGitHubRelease({
  owner,
  repo,
  releaseId,
  token,
  apiBaseUrl,
  fetchImpl = fetch
}) {
  await requestGitHub(`/repos/${owner}/${repo}/releases/${releaseId}`, {
    apiBaseUrl,
    token,
    method: 'DELETE',
    fetchImpl
  });
}

export async function deleteGitHubTagRef({
  owner,
  repo,
  tag,
  token,
  apiBaseUrl,
  fetchImpl = fetch
}) {
  await requestGitHub(`/repos/${owner}/${repo}/git/refs/tags/${encodeURIComponent(tag)}`, {
    apiBaseUrl,
    token,
    method: 'DELETE',
    fetchImpl
  });
}

export async function promptForReleaseConflict(
  { tag, conflict },
  { input = defaultInput, output = defaultOutput } = {}
) {
  if (!input.isTTY || !output.isTTY) {
    throw new Error(`Release ${tag} already exists and interactive input is unavailable.`);
  }

  const summary = buildReleaseConflictSummary(conflict);
  const rl = createInterface({ input, output });

  try {
    while (true) {
      output.write(
        `Release ${tag} is already in use (${summary}).\n` +
          `  1. Increment to the next patch version\n` +
          `  2. Clear and replace the existing release\n`
      );
      const answer = (await rl.question('Choose 1 or 2: ')).trim();

      if (answer === '1') {
        return 'increment';
      }

      if (answer === '2') {
        return 'replace';
      }

      output.write('Please enter 1 or 2.\n');
    }
  } finally {
    rl.close();
  }
}

export async function resolveReleaseTargetVersion({
  initialVersion,
  changelogContents,
  checkConflict,
  deleteConflict,
  promptChoice
}) {
  let version = normalizePackageVersion(initialVersion);

  while (true) {
    validateChangelogForVersion(version, changelogContents);

    const tag = normalizeReleaseVersion(version);
    const conflict = await checkConflict({ version, tag });

    if (!hasReleaseConflict(conflict)) {
      return {
        version,
        tag
      };
    }

    const choice = await promptChoice({ version, tag, conflict });

    if (choice === 'increment') {
      version = incrementPatchVersion(version);
      continue;
    }

    if (choice === 'replace') {
      await deleteConflict({ version, tag, conflict });
      return {
        version,
        tag
      };
    }

    throw new Error(`Unsupported release conflict choice: ${choice}`);
  }
}

export async function runReleasePublic({
  cwd = projectRoot,
  env = process.env,
  platform = process.platform,
  packageJsonPath = PACKAGE_JSON_PATH,
  packageLockPath = PACKAGE_LOCK_PATH,
  changelogPath = CHANGELOG_PATH,
  readFile = readFileSync,
  pathExists = existsSync,
  execOutputImpl = execOutput,
  runImpl = run,
  fetchImpl = fetch,
  promptChoice,
  input = defaultInput,
  output = defaultOutput,
  logger = console
} = {}) {
  const token = getGitHubToken(env);
  if (!token) {
    throw new Error('Set GH_TOKEN or GITHUB_TOKEN before running a public release.');
  }

  const currentBranch = (
    await execOutputImpl('git', ['branch', '--show-current'], { cwd, env })
  ).trim();
  if (currentBranch !== RELEASE_BRANCH) {
    throw new Error(
      `Public releases must run from ${RELEASE_BRANCH}; found ${currentBranch || 'detached HEAD'}.`
    );
  }

  const statusOutput = await execOutputImpl('git', ['status', '--porcelain'], { cwd, env });
  if (!isGitWorktreeClean(statusOutput)) {
    throw new Error('Public release requires a clean git worktree.');
  }

  const fetchInvocation = getGitFetchInvocation(RELEASE_BRANCH);
  await runImpl(fetchInvocation.command, fetchInvocation.args, {
    cwd,
    env,
    shell: fetchInvocation.shell
  });

  const [localMain, remoteMain, remoteUrl] = await Promise.all([
    execOutputImpl('git', ['rev-parse', RELEASE_BRANCH], { cwd, env }),
    execOutputImpl('git', ['rev-parse', `origin/${RELEASE_BRANCH}`], { cwd, env }),
    execOutputImpl('git', ['remote', 'get-url', 'origin'], { cwd, env })
  ]);

  if (localMain.trim() !== remoteMain.trim()) {
    throw new Error(
      `Local ${RELEASE_BRANCH} must match origin/${RELEASE_BRANCH} before releasing.`
    );
  }

  const { owner, repo, apiBaseUrl } = parseGitHubRepoFromRemote(remoteUrl);
  const packageJson = JSON.parse(readFile(packageJsonPath, 'utf8'));
  const initialVersion = normalizePackageVersion(packageJson.version);
  const changelogContents = readFile(changelogPath, 'utf8');
  const prompt =
    promptChoice ??
    ((context) =>
      promptForReleaseConflict(context, {
        input,
        output
      }));

  const target = await resolveReleaseTargetVersion({
    initialVersion,
    changelogContents,
    checkConflict: async ({ tag }) => {
      const [release, remoteTag, localTag] = await Promise.all([
        getGitHubReleaseByTag({
          owner,
          repo,
          tag,
          token,
          apiBaseUrl,
          fetchImpl
        }),
        getGitHubTagRef({
          owner,
          repo,
          tag,
          token,
          apiBaseUrl,
          fetchImpl
        }),
        gitLocalTagExists(tag, {
          cwd,
          env,
          execOutputImpl
        })
      ]);

      return {
        release,
        remoteTag,
        localTag
      };
    },
    deleteConflict: async ({ tag, conflict }) => {
      if (conflict.release) {
        logger.log(`Deleting existing GitHub release ${tag}...`);
        await deleteGitHubRelease({
          owner,
          repo,
          releaseId: conflict.release.id,
          token,
          apiBaseUrl,
          fetchImpl
        });
      }

      if (conflict.remoteTag) {
        logger.log(`Deleting existing remote tag ${tag}...`);
        await deleteGitHubTagRef({
          owner,
          repo,
          tag,
          token,
          apiBaseUrl,
          fetchImpl
        });
      }

      if (conflict.localTag) {
        logger.log(`Deleting existing local tag ${tag}...`);
        const deleteLocalTag = getGitDeleteLocalTagInvocation(tag);
        await runImpl(deleteLocalTag.command, deleteLocalTag.args, {
          cwd,
          env,
          shell: deleteLocalTag.shell
        });
      }
    },
    promptChoice: prompt
  });

  if (target.version !== initialVersion) {
    logger.log(`Updating package version to ${target.version}...`);
    const versionInvocation = getNpmVersionInvocation(target.version, env, platform);
    await runImpl(versionInvocation.command, versionInvocation.args, {
      cwd,
      env,
      shell: versionInvocation.shell
    });

    const stagedFiles = [packageJsonPath];
    if (pathExists(packageLockPath)) {
      stagedFiles.push(packageLockPath);
    }

    const addInvocation = getGitAddInvocation(
      stagedFiles.map((filePath) => relative(cwd, filePath))
    );
    await runImpl(addInvocation.command, addInvocation.args, {
      cwd,
      env,
      shell: addInvocation.shell
    });

    const commitInvocation = getGitCommitInvocation(target.tag);
    await runImpl(commitInvocation.command, commitInvocation.args, {
      cwd,
      env,
      shell: commitInvocation.shell
    });
  }

  const tagInvocation = getGitTagInvocation(target.tag);
  await runImpl(tagInvocation.command, tagInvocation.args, {
    cwd,
    env,
    shell: tagInvocation.shell
  });

  const pushBranchInvocation = getGitPushBranchInvocation(RELEASE_BRANCH);
  await runImpl(pushBranchInvocation.command, pushBranchInvocation.args, {
    cwd,
    env,
    shell: pushBranchInvocation.shell
  });

  const pushTagInvocation = getGitPushTagInvocation(target.tag);
  await runImpl(pushTagInvocation.command, pushTagInvocation.args, {
    cwd,
    env,
    shell: pushTagInvocation.shell
  });

  logger.log(`Triggered public GitHub release flow for ${target.tag}.`);

  return target;
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  runReleasePublic().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
