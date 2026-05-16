import { copyFileSync, existsSync, readFileSync, renameSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';

const DEFAULT_WRITE_DELAY_MS = 150;

export type LoadJsonFileStateOptions<T> = {
  createFallback: () => T;
  deserialize: (value: unknown) => T;
  now?: () => Date;
};

export type LoadJsonFileStateResult<T> = {
  value: T;
  backupPath?: string;
  needsRewrite: boolean;
  wasMissing: boolean;
};

export type BufferedJsonFileOptions<T> = {
  getValue: () => T;
  delayMs?: number;
  serialize?: (value: T) => string;
};

export function toPrettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function createCorruptBackupPath(filePath: string, at: Date): string {
  return `${filePath}.corrupt-${at.toISOString().replace(/[:.]/g, '-')}`;
}

function backupCorruptFile(
  filePath: string,
  now: () => Date = () => new Date()
): string | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }

  const backupPath = createCorruptBackupPath(filePath, now());
  try {
    renameSync(filePath, backupPath);
    return backupPath;
  } catch {
    try {
      copyFileSync(filePath, backupPath);
      return backupPath;
    } catch {
      return undefined;
    }
  }
}

export function loadJsonFileState<T>(
  filePath: string,
  options: LoadJsonFileStateOptions<T>
): LoadJsonFileStateResult<T> {
  if (!existsSync(filePath)) {
    return {
      value: options.createFallback(),
      needsRewrite: false,
      wasMissing: true
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    return {
      value: options.deserialize(parsed),
      needsRewrite: false,
      wasMissing: false
    };
  } catch {
    return {
      value: options.createFallback(),
      backupPath: backupCorruptFile(filePath, options.now),
      needsRewrite: true,
      wasMissing: false
    };
  }
}

export class BufferedJsonFile<T> {
  private timer: NodeJS.Timeout | null = null;
  private dirty = false;
  private flushing = false;
  private flushPromise: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly options: BufferedJsonFileOptions<T>
  ) {}

  scheduleWrite(): void {
    this.dirty = true;

    if ((this.options.delayMs ?? DEFAULT_WRITE_DELAY_MS) <= 0) {
      void this.flushNow();
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    if (this.flushing) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.startFlushLoop();
    }, this.options.delayMs ?? DEFAULT_WRITE_DELAY_MS);
  }

  async flushNow(): Promise<void> {
    this.dirty = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    return this.startFlushLoop();
  }

  async flushPendingOnDispose(): Promise<void> {
    if (!this.dirty && !this.flushing && this.timer == null) {
      return;
    }

    await this.flushNow();
  }

  private startFlushLoop(): Promise<void> {
    if (this.flushing) {
      return this.flushPromise;
    }

    this.flushing = true;
    this.flushPromise = (async () => {
      do {
        this.dirty = false;
        const content = (this.options.serialize ?? toPrettyJson)(this.options.getValue());
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, content, 'utf8');
      } while (this.dirty);
    })().finally(() => {
      this.flushing = false;
    });

    return this.flushPromise;
  }
}
