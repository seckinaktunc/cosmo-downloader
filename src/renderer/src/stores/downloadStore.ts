import { create } from 'zustand';
import type {
  AppSettings,
  DownloadProgress,
  DownloadStage,
  ExportSettings,
  IpcResult,
  VideoMetadata
} from '../../../shared/types';

type DownloadState = {
  stage: DownloadStage;
  progress: DownloadProgress | null;
  error?: string;
  isSubscribed: boolean;
  trackedPreviewQueueItemId?: string;
  trackedPreviewUrl?: string;
  completedPreviewUrl?: string;
  subscribe: () => void;
  start: (
    metadata: VideoMetadata,
    exportSettings: ExportSettings,
    settings: AppSettings
  ) => Promise<void>;
  startHistory: (entryId: string) => Promise<boolean>;
  cancel: () => Promise<void>;
  reset: () => void;
  resetForNewPreview: () => void;
  trackPreviewDownload: (queueItemId: string, sourceUrl: string) => void;
  markTrackedPreviewCompleted: (queueItemId: string) => void;
  clearPreviewDownloadState: () => void;
};

const ACTIVE_STAGES: DownloadStage[] = ['downloading', 'processing'];

async function startStandaloneDownload(
  set: (
    partial: Partial<DownloadState> | ((state: DownloadState) => Partial<DownloadState>)
  ) => void,
  get: () => DownloadState,
  request: () => Promise<IpcResult<DownloadProgress>>,
  options: {
    clearPreviewTracking?: boolean;
  } = {}
): Promise<boolean> {
  if (ACTIVE_STAGES.includes(get().stage)) {
    await get().cancel();
    return false;
  }

  set((state) => ({
    stage: 'downloading',
    progress: { stage: 'downloading', stageLabel: 'Downloading', percentage: 0 },
    error: undefined,
    trackedPreviewQueueItemId: options.clearPreviewTracking
      ? undefined
      : state.trackedPreviewQueueItemId,
    trackedPreviewUrl: options.clearPreviewTracking ? undefined : state.trackedPreviewUrl,
    completedPreviewUrl: options.clearPreviewTracking ? undefined : state.completedPreviewUrl
  }));

  const result = await request();
  if (!result.ok) {
    set({
      stage: result.error.code === 'CANCELLED' ? 'cancelled' : 'failed',
      error: result.error.message
    });
    return false;
  }

  set({ stage: result.data.stage, progress: result.data });
  return true;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  stage: 'idle',
  progress: null,
  isSubscribed: false,

  subscribe: () => {
    if (get().isSubscribed) {
      return;
    }

    window.cosmo.download.onProgress((progress) => {
      if (progress.queuedItemId != null) {
        set((state) => {
          if (progress.queuedItemId !== state.trackedPreviewQueueItemId) {
            return {};
          }

          if (progress.stage === 'completed' && state.trackedPreviewUrl) {
            return {
              completedPreviewUrl: state.trackedPreviewUrl,
              trackedPreviewQueueItemId: undefined,
              trackedPreviewUrl: undefined
            };
          }

          if (progress.stage === 'failed' || progress.stage === 'cancelled') {
            return {
              trackedPreviewQueueItemId: undefined,
              trackedPreviewUrl: undefined
            };
          }

          return {};
        });
        return;
      }

      set({
        stage: progress.stage,
        progress,
        error: progress.stage === 'failed' ? progress.message : undefined
      });
    });
    set({ isSubscribed: true });
  },

  start: async (metadata, exportSettings, settings) => {
    await startStandaloneDownload(
      set,
      get,
      () => window.cosmo.download.start({ metadata, exportSettings, settings })
    );
  },

  startHistory: async (entryId) =>
    startStandaloneDownload(
      set,
      get,
      () => window.cosmo.history.startDownload({ entryId }),
      { clearPreviewTracking: true }
    ),

  cancel: async () => {
    await window.cosmo.download.cancel();
    set({ stage: 'cancelled', progress: { stage: 'cancelled', stageLabel: 'Cancelled' } });
  },

  reset: () => set({ stage: 'idle', progress: null, error: undefined }),

  resetForNewPreview: () =>
    set((state) => {
      if (ACTIVE_STAGES.includes(state.stage)) {
        return {
          trackedPreviewQueueItemId: undefined,
          trackedPreviewUrl: undefined,
          completedPreviewUrl: undefined
        };
      }

      return {
        stage: 'idle',
        progress: null,
        error: undefined,
        trackedPreviewQueueItemId: undefined,
        trackedPreviewUrl: undefined,
        completedPreviewUrl: undefined
      };
    }),

  trackPreviewDownload: (queueItemId, sourceUrl) =>
    set({
      trackedPreviewQueueItemId: queueItemId,
      trackedPreviewUrl: sourceUrl,
      completedPreviewUrl: undefined
    }),

  markTrackedPreviewCompleted: (queueItemId) =>
    set((state) => {
      if (state.trackedPreviewQueueItemId !== queueItemId || !state.trackedPreviewUrl) {
        return {};
      }

      return {
        completedPreviewUrl: state.trackedPreviewUrl,
        trackedPreviewQueueItemId: undefined,
        trackedPreviewUrl: undefined
      };
    }),

  clearPreviewDownloadState: () =>
    set({
      trackedPreviewQueueItemId: undefined,
      trackedPreviewUrl: undefined,
      completedPreviewUrl: undefined
    })
}));
