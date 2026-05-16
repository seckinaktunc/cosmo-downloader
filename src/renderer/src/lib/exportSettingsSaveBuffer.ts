import type { ExportSettings } from '../../../shared/types';

type StoreSetter<State> = (
  partial: Partial<State> | ((state: State) => Partial<State>)
) => void;

type PendingExportSettingsSave = {
  timer: ReturnType<typeof setTimeout>;
  exportSettings: ExportSettings;
};

type ExportSettingsSaveBufferOptions<State, Key extends string> = {
  applyOptimistic: (
    set: StoreSetter<State>,
    key: Key,
    exportSettings: ExportSettings
  ) => void;
  persist: (
    set: StoreSetter<State>,
    key: Key,
    exportSettings: ExportSettings
  ) => Promise<void>;
  delayMs?: number;
};

export function createExportSettingsSaveBuffer<State, Key extends string>({
  applyOptimistic,
  persist,
  delayMs = 300
}: ExportSettingsSaveBufferOptions<State, Key>): {
  save: (set: StoreSetter<State>, key: Key, exportSettings: ExportSettings) => Promise<void>;
  saveDebounced: (set: StoreSetter<State>, key: Key, exportSettings: ExportSettings) => void;
  flush: (set: StoreSetter<State>) => Promise<void>;
} {
  const pendingSaves = new Map<Key, PendingExportSettingsSave>();

  const clearPendingSave = (key: Key): void => {
    const pendingSave = pendingSaves.get(key);
    if (!pendingSave) {
      return;
    }

    globalThis.clearTimeout(pendingSave.timer);
    pendingSaves.delete(key);
  };

  return {
    save: async (set, key, exportSettings) => {
      clearPendingSave(key);
      applyOptimistic(set, key, exportSettings);
      await persist(set, key, exportSettings);
    },

    saveDebounced: (set, key, exportSettings) => {
      clearPendingSave(key);
      applyOptimistic(set, key, exportSettings);

      const timer = globalThis.setTimeout(() => {
        pendingSaves.delete(key);
        void persist(set, key, exportSettings);
      }, delayMs);

      pendingSaves.set(key, { timer, exportSettings });
    },

    flush: async (set) => {
      const saves = Array.from(pendingSaves.entries());
      pendingSaves.clear();

      await Promise.all(
        saves.map(([key, pendingSave]) => {
          globalThis.clearTimeout(pendingSave.timer);
          return persist(set, key, pendingSave.exportSettings);
        })
      );
    }
  };
}
