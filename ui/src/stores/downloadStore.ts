import { create } from "zustand";
import type { DownloadState, DownloadStatus } from "../types/download";
import { AUDIO_BITRATE_OPTIONS, FORMAT_OPTIONS, VIDEO_FPS_OPTIONS, VIDEO_RES_OPTIONS } from "../constants/options";

export type FormatOption = typeof FORMAT_OPTIONS[number]["value"];
export type ResolutionOption = typeof VIDEO_RES_OPTIONS[number]["value"];
export type AudioBitrateOption = typeof AUDIO_BITRATE_OPTIONS[number]["value"];
export type FPSOption = typeof VIDEO_FPS_OPTIONS[number]["value"];

interface DownloadStore extends DownloadState {
  url: string;
  status: DownloadStatus;
  progress: number;
  format: FormatOption;
  resolution: ResolutionOption;
  bitrate: AudioBitrateOption;
  fps: FPSOption;

  setUrl: (url: string) => void;
  setFormat: (format: FormatOption) => void;
  setResolution: (resolution: ResolutionOption) => void;
  setBitrate: (bitrate: AudioBitrateOption) => void;
  setFPS: (fps: FPSOption) => void;
  markDownloading: () => void;
  setProgress: (progress: number) => void;

  markDone: () => void;
  markError: () => void;

  reset: () => void;
}

export const useDownloadStore = create<DownloadStore>((set) => ({
  url: "",
  status: "idle",
  progress: 0,
  format: "mp4",
  resolution: 1080,
  bitrate: 192,
  fps: 30,

  setUrl: (url) => set({ url: url }),
  setFormat: (format) => set({ format }),
  setResolution: (resolution) => set({ resolution }),
  setBitrate: (bitrate) => set({ bitrate }),
  setFPS: (fps) => set({ fps }),

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
}));