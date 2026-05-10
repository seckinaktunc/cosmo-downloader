import { net } from 'electron';
import { extname } from 'path';
import type {
  FetchScrubPreviewFragmentRequest,
  FetchScrubPreviewFragmentResult,
  IpcResult,
  ScrubPreviewHeaders
} from '../../shared/types';
import type { CacheBudgetCoordinator } from './cacheBudgetCoordinator';
import { fail, ok } from '../utils/ipcResult';

type InflightFragmentCacheEntry = {
  state: 'inflight';
  promise: Promise<IpcResult<FetchScrubPreviewFragmentResult>>;
};

type SucceededFragmentCacheEntry = {
  state: 'succeeded';
  promise: Promise<IpcResult<FetchScrubPreviewFragmentResult>>;
  result: IpcResult<FetchScrubPreviewFragmentResult>;
};

type FragmentCacheEntry = InflightFragmentCacheEntry | SucceededFragmentCacheEntry;

function validateRemoteImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function normalizeHeaders(
  headers: ScrubPreviewHeaders | undefined
): ScrubPreviewHeaders | undefined {
  if (!headers) {
    return undefined;
  }

  const entries = Object.entries(headers)
    .filter((entry): entry is [string, string] => {
      const [key, value] = entry;
      return key.trim().length > 0 && typeof value === 'string' && value.trim().length > 0;
    })
    .sort(([left], [right]) => left.localeCompare(right));

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function createCacheKey(url: string, headers: ScrubPreviewHeaders | undefined): string {
  return `${url}\u001f${JSON.stringify(headers ?? {})}`;
}

function contentTypeFromUrl(url: URL): string | undefined {
  const extension = extname(url.pathname).replace(/^\./, '').toLowerCase();

  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  return undefined;
}

function getBudgetEntryId(cacheKey: string): string {
  return `scrubPreview:${cacheKey}`;
}

function getDataUrlSizeBytes(result: IpcResult<FetchScrubPreviewFragmentResult>): number {
  if (!result.ok) {
    return 0;
  }

  return Buffer.byteLength(result.data.dataUrl, 'utf8');
}

export class ScrubPreviewService {
  private readonly fragmentCache = new Map<string, FragmentCacheEntry>();

  constructor(private readonly cacheBudgetCoordinator?: CacheBudgetCoordinator) {}

  hasClearableEntries(): boolean {
    for (const entry of this.fragmentCache.values()) {
      if (entry.state === 'succeeded') {
        return true;
      }
    }

    return false;
  }

  getRetainedSizeBytes(): number {
    let sizeBytes = 0;
    for (const entry of this.fragmentCache.values()) {
      if (entry.state === 'succeeded') {
        sizeBytes += getDataUrlSizeBytes(entry.result);
      }
    }
    return sizeBytes;
  }

  clearCompleted(): void {
    for (const [cacheKey, entry] of Array.from(this.fragmentCache.entries())) {
      if (entry.state !== 'succeeded') {
        continue;
      }

      this.fragmentCache.delete(cacheKey);
      this.cacheBudgetCoordinator?.removeEntry(getBudgetEntryId(cacheKey));
    }
  }

  async fetchScrubPreviewFragment(
    request: FetchScrubPreviewFragmentRequest
  ): Promise<IpcResult<FetchScrubPreviewFragmentResult>> {
    const url = validateRemoteImageUrl(request.url);
    if (!url) {
      return fail('VALIDATION_ERROR', 'Scrub preview URL must be HTTP or HTTPS.');
    }

    const headers = normalizeHeaders(request.headers);
    const cacheKey = createCacheKey(url.toString(), headers);
    const cached = this.fragmentCache.get(cacheKey);
    if (cached) {
      return cached.promise;
    }

    const promise = (async (): Promise<IpcResult<FetchScrubPreviewFragmentResult>> => {
      try {
        const response = await net.fetch(url.toString(), headers ? { headers } : undefined);
        if (!response.ok) {
          return fail(
            'PROCESS_FAILED',
            `Scrub preview request failed with status ${response.status}.`
          );
        }

        const contentType =
          response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ??
          contentTypeFromUrl(url);
        if (!contentType?.startsWith('image/')) {
          return fail('PROCESS_FAILED', 'Scrub preview response was not an image.');
        }

        const arrayBuffer = await response.arrayBuffer();
        const dataUrl = `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`;
        return ok({ dataUrl });
      } catch (error) {
        return fail('PROCESS_FAILED', error instanceof Error ? error.message : String(error));
      }
    })();

    this.fragmentCache.set(cacheKey, { state: 'inflight', promise });

    const result = await promise;
    if (!result.ok) {
      this.fragmentCache.delete(cacheKey);
      return result;
    }

    this.fragmentCache.set(cacheKey, {
      state: 'succeeded',
      promise,
      result
    });
    this.cacheBudgetCoordinator?.upsertEntry({
      id: getBudgetEntryId(cacheKey),
      kind: 'scrubPreview',
      sizeBytes: getDataUrlSizeBytes(result),
      evict: () => {
        const entry = this.fragmentCache.get(cacheKey);
        if (entry?.state === 'succeeded') {
          this.fragmentCache.delete(cacheKey);
        }
      }
    });
    return result;
  }
}
