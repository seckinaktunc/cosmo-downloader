import { describe, expect, it, vi } from 'vitest';
import { CacheBudgetCoordinator } from '@main/services/cacheBudgetCoordinator';

describe('CacheBudgetCoordinator', () => {
  it('evicts the oldest completed entry when the shared budget is exceeded', () => {
    const coordinator = new CacheBudgetCoordinator(10);
    const evictFirst = vi.fn();
    const evictSecond = vi.fn();

    coordinator.upsertEntry({
      id: 'metadata:first',
      kind: 'metadataPrefetch',
      sizeBytes: 6,
      evict: evictFirst
    });
    coordinator.upsertEntry({
      id: 'scrub:second',
      kind: 'scrubPreview',
      sizeBytes: 6,
      evict: evictSecond
    });

    expect(evictFirst).toHaveBeenCalledTimes(1);
    expect(evictSecond).not.toHaveBeenCalled();
    expect(coordinator.getTotalSizeBytes()).toBe(6);
  });

  it('evicts existing entries immediately when the limit is lowered', () => {
    const coordinator = new CacheBudgetCoordinator(20);
    const evictFirst = vi.fn();
    const evictSecond = vi.fn();

    coordinator.upsertEntry({
      id: 'metadata:first',
      kind: 'metadataPrefetch',
      sizeBytes: 8,
      evict: evictFirst
    });
    coordinator.upsertEntry({
      id: 'scrub:second',
      kind: 'scrubPreview',
      sizeBytes: 7,
      evict: evictSecond
    });

    coordinator.setLimitBytes(7);

    expect(evictFirst).toHaveBeenCalledTimes(1);
    expect(evictSecond).not.toHaveBeenCalled();
    expect(coordinator.getTotalSizeBytes()).toBe(7);
  });
});
