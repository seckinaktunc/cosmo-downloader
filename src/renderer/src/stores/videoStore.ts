import { create } from 'zustand';
import type {
  AppSettings,
  DownloadStage,
  MetadataFetchLifecycleEvent,
  VideoMetadata
} from '../../../shared/types';
import { getValidLookingSingleVideoUrl } from '../lib/urlInput';
import { validateUrl } from '../lib/validateUrl';
import { classifyVideoUrl } from '../lib/videoUrlClassifier';
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
  fetchMetadata: (settings: AppSettings) => Promise<void>;
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

  fetchMetadata: async (settings) => {
    const url = get().url.trim();
    const validation = validateUrl(url);
    if (!validation.isValid || !validation.normalized) {
      set({ metadata: null, stage: 'idle', error: validation.reason, activeFetchLog: null });
      return;
    }

    const kind = classifyVideoUrl(validation.normalized);
    if (kind === 'playlist' || kind === 'channel') {
      set({
        metadata: null,
        stage: 'failed',
        error: 'Only single-video links are supported in this version.',
        activeFetchLog: null
      });
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
      settings
    });

    if (get().activeRequestId !== requestId) {
      return;
    }

    if (result.ok) {
      useUiStore.getState().initializePreviewExportSettings(result.data, settings);
      const resolvedExportSettings = useUiStore.getState().previewExportSettings;
      const activeFetchLog = get().activeFetchLog;
      const recordResult =
        activeFetchLog?.requestId === requestId
          ? await window.cosmo.history.recordFetch({
              metadata: result.data,
              exportSettings: resolvedExportSettings,
              settings,
              status: 'fetched',
              logPath: activeFetchLog.logPath
            })
          : null;
      useDownloadStore.getState().resetForNewPreview();
      set({
        metadata: result.data,
        stage: 'ready',
        error: undefined,
        activeRequestId: undefined,
        activeFetchLog: recordResult == null || recordResult.ok ? null : activeFetchLog
      });
      return;
    }

    if (result.error.code === 'CANCELLED') {
      set({ activeFetchLog: null, activeRequestId: undefined });
      return;
    }

    const activeFetchLog = get().activeFetchLog;
    const recordResult =
      activeFetchLog?.requestId === requestId
        ? await window.cosmo.history.recordFetch({
            metadata: createFailedFetchMetadata(requestId, validation.normalized),
            exportSettings: useUiStore.getState().previewExportSettings,
            settings,
            status: 'fetch_failed',
            logPath: activeFetchLog.logPath,
            error: result.error.message
          })
        : null;
    set({
      metadata: null,
      stage: 'failed',
      error: result.error.message,
      activeRequestId: undefined,
      activeFetchLog: recordResult == null || recordResult.ok ? null : activeFetchLog
    });
  }
}));
