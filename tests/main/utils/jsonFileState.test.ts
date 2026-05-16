import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BufferedJsonFile, loadJsonFileState } from '@main/utils/jsonFileState';

const tempDirs: string[] = [];

function createTempPath(filename: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'cosmo-json-state-'));
  tempDirs.push(directory);
  return join(directory, filename);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe('BufferedJsonFile', () => {
  it('coalesces rapid scheduled writes into one flush', async () => {
    const filePath = createTempPath('state.json');
    const state = { value: 1 };
    const serialize = vi.fn((value: typeof state) => `${JSON.stringify(value)}\n`);
    const persistence = new BufferedJsonFile(filePath, {
      getValue: () => state,
      delayMs: 20,
      serialize
    });

    persistence.scheduleWrite();
    state.value = 2;
    persistence.scheduleWrite();
    state.value = 3;
    persistence.scheduleWrite();

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(serialize).toHaveBeenCalledTimes(1);
    expect(readFileSync(filePath, 'utf8')).toBe('{"value":3}\n');
  });

  it('flushes immediately when flushNow is requested', async () => {
    const filePath = createTempPath('state.json');
    const state = { value: 7 };
    const persistence = new BufferedJsonFile(filePath, {
      getValue: () => state,
      delayMs: 1000
    });

    await persistence.flushNow();

    expect(readFileSync(filePath, 'utf8')).toBe('{\n  "value": 7\n}\n');
  });

  it('flushes pending writes during dispose', async () => {
    const filePath = createTempPath('state.json');
    const state = { value: 9 };
    const persistence = new BufferedJsonFile(filePath, {
      getValue: () => state,
      delayMs: 1000
    });

    persistence.scheduleWrite();
    await persistence.flushPendingOnDispose();

    expect(readFileSync(filePath, 'utf8')).toBe('{\n  "value": 9\n}\n');
  });
});

describe('loadJsonFileState', () => {
  it('backs up corrupt JSON and rewrites fallback data', async () => {
    const filePath = createTempPath('state.json');
    writeFileSync(filePath, '{"broken":', 'utf8');

    const loaded = loadJsonFileState(filePath, {
      createFallback: () => ({ value: 10 }),
      deserialize: (value) => value as { value: number },
      now: () => new Date('2026-05-16T10:00:00.000Z')
    });

    expect(loaded.value).toEqual({ value: 10 });
    expect(loaded.needsRewrite).toBe(true);
    expect(loaded.backupPath).toContain('.corrupt-2026-05-16T10-00-00-000Z');
    expect(loaded.backupPath && existsSync(loaded.backupPath)).toBe(true);

    const persistence = new BufferedJsonFile(filePath, {
      getValue: () => loaded.value
    });
    await persistence.flushNow();

    expect(readFileSync(filePath, 'utf8')).toBe('{\n  "value": 10\n}\n');
  });
});
