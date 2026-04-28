import { create } from 'zustand';
import type {
  AppSettings,
  DownloadStage,
  MetadataFetchLifecycleEvent,
  VideoMetadata
} from '../../../shared/types';
import { getValidLookingSingleVideoUrl } from '../lib/urlInput';
import { validateUrl } from '../lib/validateUrl';
import { useDownloadStore } from './downloadStore';
import { useUiStore } from './uiStore';

function createFailedFetchMetadata(requestId: string, url: string): VideoMetadata {
  return {
    requestId,
    url,
    title: url,
    containers: [],
    videoCodecs: [],
    audioCodecs: [],
    fpsOptions: [],
    formats: []
  };
}

type VideoState = {
  url: string;
  metadata: VideoMetadata | null;
  stage: DownloadStage;
  error?: string;
  activeRequestId?: string;
  activeFetchLog: MetadataFetchLifecycleEvent | null;
  isSubscribed: boolean;
  setUrl: (url: string) => void;
  clear: () => void;
  subscribe: () => void;
  fetchMetadata: (settings: AppSettings, options?: { forceRefresh?: boolean }) => Promise<void>;
  retryMetadata: (settings: AppSettings) => Promise<void>;
};

export const useVideoStore = create<VideoState>((set, get) => ({
  url: '',
  metadata: null,
  stage: 'idle',
  activeFetchLog: null,
  isSubscribed: false,

  setUrl: (url) => {
    const requestId = get().activeRequestId;
    if (requestId) {
      void window.cosmo.video.cancelMetadata({ requestId });
    }

    useUiStore.getState().clearPreviewExportTarget();
    useDownloadStore.getState().resetForNewPreview();
    const validLookingUrl = getValidLookingSingleVideoUrl(url);
    set({
      url,
      metadata: null,
      stage: validLookingUrl ? 'fetching_metadata' : 'idle',
      error: undefined,
      activeRequestId: undefined,
      activeFetchLog: null
    });
  },

  clear: () => {
    const requestId = get().activeRequestId;
    if (requestId) {
      void window.cosmo.video.cancelMetadata({ requestId });
    }

    useUiStore.getState().clearPreviewExportTarget();
    useDownloadStore.getState().clearPreviewDownloadState();
    set({
      url: '',
      metadata: null,
      stage: 'idle',
      error: undefined,
      activeRequestId: undefined,
      activeFetchLog: null
    });
  },

  subscribe: () => {
    if (get().isSubscribed) {
      return;
    }

    window.cosmo.video.onFetchLifecycle((event) => {
      const state = get();
      if (event.state === 'started') {
        if (state.activeRequestId === event.requestId) {
          set({ activeFetchLog: event });
        }
        return;
      }

      if (
        state.activeFetchLog?.requestId === event.requestId ||
        state.activeRequestId === event.requestId
      ) {
        set({ activeFetchLog: event.state === 'cancelled' ? null : event });
      }
    });

    set({ isSubscribed: true });
  },

  fetchMetadata: async (settings, options) => {
    const url = get().url.trim();
    const validation = validateUrl(url);
    if (!validation.isValid || !validation.normalized) {
      set({ metadata: null, stage: 'idle', error: validation.reason, activeFetchLog: null });
      return;
    }

    const previousRequestId = get().activeRequestId;
    if (previousRequestId) {
      void window.cosmo.video.cancelMetadata({ requestId: previousRequestId });
    }

    const requestId = crypto.randomUUID();
    set({
      activeRequestId: requestId,
      stage: 'fetching_metadata',
      error: undefined,
      activeFetchLog: null
    });

    const result = await window.cosmo.video.fetchMetadata({
      requestId,
      url: validation.normalized,
      settings,
      forceRefresh: options?.forceRefresh
    });

    if (get().activeRequestId !== requestId) {
      return;
    }

    const fetchResult = result.result;
    const responseLogPath = result.logPath;
    const resolvedFetchLog =
      responseLogPath != null
        ? {
            requestId,
            url: validation.normalized,
            logPath: responseLogPath,
            state: fetchResult.ok ? ('succeeded' as const) : ('failed' as const),
            timestamp: new Date().toISOString()
          }
        : get().activeFetchLog;

    if (fetchResult.ok) {
      useUiStore.getState().initializePreviewExportSettings(fetchResult.data, settings);
      const resolvedExportSettings = useUiStore.getState().previewExportSettings;
      const recordResult =
        responseLogPath != null
          ? await window.cosmo.history.recordFetch({
              metadata: fetchResult.data,
              exportSettings: resolvedExportSettings,
              settings,
              status: 'fetched',
              logPath: responseLogPath
            })
          : null;
      useDownloadStore.getState().resetForNewPreview();
      set({
        metadata: fetchResult.data,
        stage: 'ready',
        error: undefined,
        activeRequestId: undefined,
        activeFetchLog: recordResult == null || recordResult.ok ? null : resolvedFetchLog
      });
      return;
    }

    if (fetchResult.error.code === 'CANCELLED') {
      set({ activeFetchLog: null, activeRequestId: undefined });
      return;
    }

    const recordResult =
      responseLogPath != null
        ? await window.cosmo.history.recordFetch({
            metadata: createFailedFetchMetadata(requestId, validation.normalized),
            exportSettings: useUiStore.getState().previewExportSettings,
            settings,
            status: 'fetch_failed',
            logPath: responseLogPath,
            error: fetchResult.error.message
          })
        : null;
    set({
      metadata: null,
      stage: 'failed',
      error: fetchResult.error.message,
      activeRequestId: undefined,
      activeFetchLog: recordResult == null || recordResult.ok ? null : resolvedFetchLog
    });
  },

  retryMetadata: async (settings) => {
    await get().fetchMetadata(settings, { forceRefresh: true });
  }
}));
