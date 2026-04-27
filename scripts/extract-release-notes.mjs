/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

export function normalizeReleaseVersion(version) {
  const trimmed = String(version ?? '')
    .trim()
    .replace(/^refs\/tags\//, '');
  if (!trimmed) {
    throw new Error('Release version is required.');
  }

  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getHeadingVersion(line) {
  const heading = /^##\s+(.+?)\s*$/.exec(line);
  if (!heading) {
    return null;
  }

  const value = heading[1].trim();
  const version = /^\[?(v?\d+\.\d+\.\d+)\]?/.exec(value);
  return version ? normalizeReleaseVersion(version[1]) : null;
}

export function extractReleaseNotes(changelog, version) {
  const targetVersion = normalizeReleaseVersion(version);
  const lines = String(changelog).split(/\r?\n/);
  const startIndex = lines.findIndex((line) => getHeadingVersion(line) === targetVersion);

  if (startIndex < 0) {
    throw new Error(`No changelog section found for ${targetVersion}.`);
  }

  const nextHeadingIndex = lines.findIndex(
    (line, index) => index > startIndex && /^##\s+/.test(line)
  );
  const bodyLines = lines.slice(
    startIndex + 1,
    nextHeadingIndex < 0 ? undefined : nextHeadingIndex
  );
  const body = bodyLines.join('\n').trim();

  if (!body) {
    throw new Error(`Changelog section for ${targetVersion} is empty.`);
  }

  return body.replace(new RegExp(`\\[${escapeRegExp(targetVersion)}\\]`, 'g'), targetVersion);
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  try {
    const [version, changelogPath = 'docs/CHANGELOG.md'] = process.argv.slice(2);
    const changelog = readFileSync(changelogPath, 'utf8');
    process.stdout.write(`${extractReleaseNotes(changelog, version)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
