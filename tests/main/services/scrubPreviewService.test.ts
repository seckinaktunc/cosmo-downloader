import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FetchScrubPreviewFragmentRequest } from '@shared/types';
import { CacheBudgetCoordinator } from '@main/services/cacheBudgetCoordinator';
import { ScrubPreviewService } from '@main/services/scrubPreviewService';

const fetchMock = vi.hoisted(() => vi.fn());

type MockImageResponse = {
  ok: true;
  status: number;
  headers: {
    get: (name: string) => string | null;
  };
  arrayBuffer: () => Promise<ArrayBuffer>;
};

vi.mock('electron', () => ({
  net: {
    fetch: fetchMock
  }
}));

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createImageResponse(content: string): MockImageResponse {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => (name === 'content-type' ? 'image/png' : null)
    },
    arrayBuffer: async () => Uint8Array.from(Buffer.from(content, 'utf8')).buffer
  };
}

function createRequest(url: string): FetchScrubPreviewFragmentRequest {
  return { url };
}

afterEach(() => {
  fetchMock.mockReset();
});

describe('ScrubPreviewService', () => {
  it('reuses the in-flight promise for duplicate requests', async () => {
    const response = deferred<ReturnType<typeof createImageResponse>>();
    fetchMock.mockImplementationOnce(() => response.promise);
    const service = new ScrubPreviewService();

    const firstPromise = service.fetchScrubPreviewFragment(
      createRequest('https://example.com/a.png')
    );
    const secondPromise = service.fetchScrubPreviewFragment(
      createRequest('https://example.com/a.png')
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    response.resolve(createImageResponse('frame-a'));
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(first).toEqual(second);
  });

  it('does not retain failed requests in the cache', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => null }
    });
    const service = new ScrubPreviewService();

    const result = await service.fetchScrubPreviewFragment(
      createRequest('https://example.com/missing.png')
    );

    expect(result.ok).toBe(false);
    expect(service.hasClearableEntries()).toBe(false);
    expect(service.getRetainedSizeBytes()).toBe(0);
  });

  it('evicts the oldest completed fragment when the shared budget is exceeded', async () => {
    const budget = new CacheBudgetCoordinator(1_000_000);
    const service = new ScrubPreviewService(budget);

    fetchMock.mockResolvedValueOnce(createImageResponse('frame-one'));
    await service.fetchScrubPreviewFragment(createRequest('https://example.com/one.png'));
    const firstSize = service.getRetainedSizeBytes();

    budget.setLimitBytes(firstSize);

    fetchMock.mockResolvedValueOnce(createImageResponse('frame-two'));
    await service.fetchScrubPreviewFragment(createRequest('https://example.com/two.png'));

    expect(service.hasClearableEntries()).toBe(true);
    expect(service.getRetainedSizeBytes()).toBeLessThanOrEqual(firstSize);

    fetchMock.mockResolvedValueOnce(createImageResponse('frame-one'));
    await service.fetchScrubPreviewFragment(createRequest('https://example.com/one.png'));

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('clears completed entries without cancelling in-flight requests', async () => {
    const response = deferred<ReturnType<typeof createImageResponse>>();
    fetchMock
      .mockResolvedValueOnce(createImageResponse('frame-one'))
      .mockImplementationOnce(() => response.promise);
    const service = new ScrubPreviewService();

    await service.fetchScrubPreviewFragment(createRequest('https://example.com/one.png'));
    const inflightPromise = service.fetchScrubPreviewFragment(
      createRequest('https://example.com/two.png')
    );

    service.clearCompleted();

    expect(service.hasClearableEntries()).toBe(false);

    response.resolve(createImageResponse('frame-two'));
    const inflightResult = await inflightPromise;

    expect(inflightResult.ok).toBe(true);
    expect(service.hasClearableEntries()).toBe(true);
  });
});
