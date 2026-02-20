import { create } from "zustand";
import type { AudioBitrateOption, FPSOption, ResolutionOption } from "./downloadStore";

export type MetadataStatus = "idle" | "fetching" | "ready" | "error";

interface MetadataStore {
  sourceUrl: string;
  status: MetadataStatus;
  availableResolutions: ResolutionOption[];
  availableFps: FPSOption[];
  availableBitrates: AudioBitrateOption[];
  thumbnailUrl: string;

  startFetch: (url: string) => void;
  applyMetadata: (payload: {
    url: string;
    availableResolutions: ResolutionOption[];
    availableFps: FPSOption[];
    availableBitrates: AudioBitrateOption[];
    thumbnailUrl: string;
  }) => void;
  markFetchError: (url: string) => void;
  reset: () => void;
}

function normalizeUrl(value: string): string {
  return value.trim();
}

export const useMetadataStore = create<MetadataStore>()((set) => ({
  sourceUrl: "",
  status: "idle",
  availableResolutions: [],
  availableFps: [],
  availableBitrates: [],
  thumbnailUrl: "",

  startFetch: (url) =>
    set({
      sourceUrl: normalizeUrl(url),
      status: "fetching",
      availableResolutions: [],
      availableFps: [],
      availableBitrates: [],
      thumbnailUrl: "",
    }),

  applyMetadata: ({ url, availableResolutions, availableFps, availableBitrates, thumbnailUrl }) =>
    set({
      sourceUrl: normalizeUrl(url),
      status: "ready",
      availableResolutions,
      availableFps,
      availableBitrates,
      thumbnailUrl,
    }),

  markFetchError: (url) =>
    set({
      sourceUrl: normalizeUrl(url),
      status: "error",
      availableResolutions: [],
      availableFps: [],
      availableBitrates: [],
      thumbnailUrl: "",
    }),

  reset: () =>
    set({
      sourceUrl: "",
      status: "idle",
      availableResolutions: [],
      availableFps: [],
      availableBitrates: [],
      thumbnailUrl: "",
    }),
}));
