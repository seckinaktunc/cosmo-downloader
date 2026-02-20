import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  isActiveDownloadStatus,
  type ActiveDownloadStatus,
  type DownloadState,
  type DownloadStatus,
} from "../types/download";
import {
  AUDIO_BITRATE_OPTIONS,
  AUDIO_CODEC_OPTIONS,
  FORMAT_OPTIONS,
  VIDEO_CODEC_OPTIONS,
  VIDEO_FPS_OPTIONS,
  VIDEO_RES_OPTIONS,
} from "../constants/options";

export type FormatOption = typeof FORMAT_OPTIONS[number];
export type ResolutionOption = typeof VIDEO_RES_OPTIONS[number];
export type AudioBitrateOption = typeof AUDIO_BITRATE_OPTIONS[number];
export type FPSOption = typeof VIDEO_FPS_OPTIONS[number];
export type VideoCodecOption = typeof VIDEO_CODEC_OPTIONS[number];
export type AudioCodecOption = typeof AUDIO_CODEC_OPTIONS[number];

interface DownloadStore extends DownloadState {
  url: string;
  status: DownloadStatus;
  progress: number;
  format: FormatOption;
  resolution: ResolutionOption;
  bitrate: AudioBitrateOption;
  fps: FPSOption;
  videoCodec: VideoCodecOption;
  audioCodec: AudioCodecOption;

  setUrl: (url: string) => void;
  setFormat: (format: FormatOption) => void;
  setResolution: (resolution: ResolutionOption) => void;
  setBitrate: (bitrate: AudioBitrateOption) => void;
  setFPS: (fps: FPSOption) => void;
  setVideoCodec: (videoCodec: VideoCodecOption) => void;
  setAudioCodec: (audioCodec: AudioCodecOption) => void;
  markDownloading: () => void;
  markMerging: () => void;
  markConverting: () => void;
  setProgress: (progress: number) => void;
  setPlaylistProgress: (current: number, total: number) => void;
  markIdle: () => void;

  markDone: () => void;
  markError: () => void;

  reset: () => void;
}

function transitionToActiveStatus(
  previousState: DownloadStore,
  nextStatus: ActiveDownloadStatus,
) {
  return {
    status: nextStatus,
    progress: isActiveDownloadStatus(previousState.status) ? previousState.progress : 0,
    playlistProgress: isActiveDownloadStatus(previousState.status) ? previousState.playlistProgress : null,
  };
}

export const useDownloadStore = create<DownloadStore>()(
  persist(
    (set) => ({
      url: "",
      status: "idle",
      progress: 0,
      playlistProgress: null,
      format: "mp4",
      resolution: 1080,
      bitrate: 192,
      fps: 30,
      videoCodec: "auto",
      audioCodec: "auto",

      setUrl: (url) => set({ url: url }),
      setFormat: (format) => set({ format }),
      setResolution: (resolution) => set({ resolution }),
      setBitrate: (bitrate) => set({ bitrate }),
      setFPS: (fps) => set({ fps }),
      setVideoCodec: (videoCodec) => set({ videoCodec }),
      setAudioCodec: (audioCodec) => set({ audioCodec }),

      markDownloading: () => set((prev) => transitionToActiveStatus(prev, "downloading")),
      markMerging: () => set((prev) => transitionToActiveStatus(prev, "merging")),
      markConverting: () => set((prev) => transitionToActiveStatus(prev, "converting")),

      setProgress: (progress) => {
        const clamped = Math.min(100, Math.max(0, progress));
        set((prev) => ({
          status: isActiveDownloadStatus(prev.status) ? prev.status : "downloading",
          progress: clamped,
        }));
      },

      setPlaylistProgress: (current, total) => {
        const safeTotal = Math.max(1, Math.trunc(total));
        const safeCurrent = Math.min(safeTotal, Math.max(1, Math.trunc(current)));
        set({
          playlistProgress: safeTotal > 1 ? { current: safeCurrent, total: safeTotal } : null,
        });
      },

      markIdle: () => set({ status: "idle", progress: 0, playlistProgress: null }),
      markDone: () => set({ status: "done", progress: 100, playlistProgress: null }),
      markError: () => set({ status: "error", progress: 0, playlistProgress: null }),

      reset: () => set({ url: "", status: "idle", progress: 0, playlistProgress: null }),
    }),
    {
      name: "cosmo-download-preferences",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        format: state.format,
        resolution: state.resolution,
        bitrate: state.bitrate,
        fps: state.fps,
        videoCodec: state.videoCodec,
        audioCodec: state.audioCodec,
      }),
    },
  ),
);
