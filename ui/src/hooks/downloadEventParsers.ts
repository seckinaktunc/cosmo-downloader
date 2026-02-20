import {
  AUDIO_BITRATE_OPTIONS,
  VIDEO_FPS_OPTIONS,
  VIDEO_RES_OPTIONS,
} from "@/constants/options";
import type { AudioBitrateOption, FPSOption, ResolutionOption } from "@/stores/downloadStore";

function parseSupportedOptions<T extends number>(
  raw: string,
  allowedValues: readonly T[],
): T[] {
  const allowedSet = new Set<number>(allowedValues);
  const unique = new Set<number>();

  for (const token of raw.split(",")) {
    const parsed = Number.parseInt(token.trim(), 10);
    if (Number.isNaN(parsed) || !allowedSet.has(parsed)) {
      continue;
    }

    unique.add(parsed);
  }

  return allowedValues.filter((value) => unique.has(value));
}

export type MetadataMessage =
  | {
    type: "success";
    url: string;
    availableResolutions: ResolutionOption[];
    availableFps: FPSOption[];
    availableBitrates: AudioBitrateOption[];
    thumbnailUrl: string;
  }
  | {
    type: "error";
    url: string;
  };

export function parseProgressMessage(message: string): number | null {
  const prefix = "status:progress:";
  if (!message.startsWith(prefix)) {
    return null;
  }

  const parsed = Number.parseInt(message.slice(prefix.length), 10);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.min(100, Math.max(0, parsed));
}

export function parsePlaylistMessage(message: string): { current: number; total: number } | null {
  const prefix = "status:playlist:";
  if (!message.startsWith(prefix)) {
    return null;
  }

  const [rawCurrent = "", rawTotal = ""] = message.slice(prefix.length).split(":");
  const current = Number.parseInt(rawCurrent, 10);
  const total = Number.parseInt(rawTotal, 10);
  if (!Number.isFinite(current) || !Number.isFinite(total) || current <= 0 || total <= 0) {
    return null;
  }

  return {
    current: Math.min(total, current),
    total,
  };
}

export function parseDownloadStatusMessage(message: string) {
  if (
    message === "status:downloading" ||
    message === "status:merging" ||
    message === "status:converting" ||
    message === "status:done" ||
    message === "status:error" ||
    message === "status:idle" ||
    message === "status:canceled"
  ) {
    return message;
  }

  return null;
}

export function parseMetadataMessage(message: string): MetadataMessage | null {
  const successPrefix = "metadata:success:";
  if (message.startsWith(successPrefix)) {
    const payload = message.slice(successPrefix.length);
    const [url = "", resolutionsRaw = "", fpsRaw = "", bitratesRaw = "", ...thumbnailParts] = payload.split("|");

    return {
      type: "success",
      url: url.trim(),
      availableResolutions: parseSupportedOptions(resolutionsRaw, VIDEO_RES_OPTIONS),
      availableFps: parseSupportedOptions(fpsRaw, VIDEO_FPS_OPTIONS),
      availableBitrates: parseSupportedOptions(bitratesRaw, AUDIO_BITRATE_OPTIONS),
      thumbnailUrl: thumbnailParts.join("|").trim(),
    };
  }

  const errorPrefix = "metadata:error:";
  if (message.startsWith(errorPrefix)) {
    return {
      type: "error",
      url: message.slice(errorPrefix.length).trim(),
    };
  }

  return null;
}
