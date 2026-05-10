export type CacheBudgetEntryKind = 'metadataPrefetch' | 'scrubPreview';

type CacheBudgetEntry = {
  id: string;
  kind: CacheBudgetEntryKind;
  sizeBytes: number;
  evict: () => void;
};

export class CacheBudgetCoordinator {
  private readonly entries = new Map<string, CacheBudgetEntry>();
  private totalSizeBytes = 0;
  private limitBytes: number;
  private enforcing = false;
  private needsEnforce = false;

  constructor(limitBytes: number) {
    this.limitBytes = Math.max(0, Math.round(limitBytes));
  }

  setLimitBytes(limitBytes: number): void {
    this.limitBytes = Math.max(0, Math.round(limitBytes));
    this.enforceBudget();
  }

  getLimitBytes(): number {
    return this.limitBytes;
  }

  getTotalSizeBytes(): number {
    return this.totalSizeBytes;
  }

  hasEntries(): boolean {
    return this.entries.size > 0;
  }

  upsertEntry(entry: CacheBudgetEntry): void {
    const normalizedSizeBytes = Math.max(0, Math.round(entry.sizeBytes));
    const existing = this.entries.get(entry.id);
    if (existing) {
      existing.kind = entry.kind;
      existing.evict = entry.evict;
      this.totalSizeBytes -= existing.sizeBytes;
      existing.sizeBytes = normalizedSizeBytes;
      this.totalSizeBytes += existing.sizeBytes;
    } else {
      this.entries.set(entry.id, { ...entry, sizeBytes: normalizedSizeBytes });
      this.totalSizeBytes += normalizedSizeBytes;
    }

    this.enforceBudget();
  }

  removeEntry(id: string): void {
    const existing = this.entries.get(id);
    if (!existing) {
      return;
    }

    this.entries.delete(id);
    this.totalSizeBytes -= existing.sizeBytes;
  }

  private enforceBudget(): void {
    if (this.enforcing) {
      this.needsEnforce = true;
      return;
    }

    this.enforcing = true;
    try {
      do {
        this.needsEnforce = false;

        while (this.totalSizeBytes > this.limitBytes) {
          const oldest = this.entries.values().next().value as CacheBudgetEntry | undefined;
          if (!oldest) {
            break;
          }

          this.entries.delete(oldest.id);
          this.totalSizeBytes -= oldest.sizeBytes;

          try {
            oldest.evict();
          } catch {
            // Best effort eviction. Keep the budget coordinator moving even if
            // one cache owner encounters cleanup issues.
          }
        }
      } while (this.needsEnforce);
    } finally {
      this.enforcing = false;
    }
  }
}
