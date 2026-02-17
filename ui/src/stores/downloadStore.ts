import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DownloadState, DownloadStatus } from "../types/download";
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
  setProgress: (progress: number) => void;

  markDone: () => void;
  markError: () => void;

  reset: () => void;
}

export const useDownloadStore = create<DownloadStore>()(
  persist(
    (set) => ({
      url: "",
      status: "idle",
      progress: 0,
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

      markDownloading: () =>
        set((prev) => ({
          status: "downloading",
          progress: prev.status === "downloading" ? prev.progress : 0,
        })),

      setProgress: (progress) => {
        const clamped = Math.min(100, Math.max(0, progress));
        set((prev) => ({
          status: "downloading",
          progress: Math.max(prev.progress, clamped),
        }));
      },

      markDone: () => set({ status: "done", progress: 100 }),
      markError: () => set({ status: "error", progress: 0 }),

      reset: () => set({ url: "", status: "idle", progress: 0 }),
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
