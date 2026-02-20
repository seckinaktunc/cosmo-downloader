type SupportedVideoPlatform = "youtube" | "instagram" | "tiktok";

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const TIKTOK_VIDEO_ID_PATTERN = /^\d+$/;
const INSTAGRAM_SHORTCODE_PATTERN = /^[A-Za-z0-9_-]+$/;

function parseUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const prepared = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(prepared);
  } catch {
    return null;
  }
}

function normalizeHostname(hostname: string): string {
  const lowered = hostname.toLowerCase();
  return lowered.startsWith("www.") ? lowered.slice(4) : lowered;
}

function splitPath(pathname: string): string[] {
  return pathname.split("/").filter((segment) => segment.length > 0);
}

function isCompleteYouTubeVideoUrl(url: URL): boolean {
  const hostname = normalizeHostname(url.hostname);
  const pathParts = splitPath(url.pathname);

  if (hostname === "youtu.be") {
    const [videoId = ""] = pathParts;
    return YOUTUBE_VIDEO_ID_PATTERN.test(videoId);
  }

  if (!hostname.endsWith("youtube.com")) {
    return false;
  }

  if (url.pathname === "/watch") {
    return YOUTUBE_VIDEO_ID_PATTERN.test(url.searchParams.get("v") ?? "");
  }

  const [first = "", second = ""] = pathParts;
  if ((first === "shorts" || first === "embed" || first === "live") && YOUTUBE_VIDEO_ID_PATTERN.test(second)) {
    return true;
  }

  return false;
}

function isCompleteInstagramVideoUrl(url: URL): boolean {
  const hostname = normalizeHostname(url.hostname);
  if (!hostname.endsWith("instagram.com")) {
    return false;
  }

  const [first = "", second = ""] = splitPath(url.pathname);
  if (first !== "reel" && first !== "p" && first !== "tv") {
    return false;
  }

  return INSTAGRAM_SHORTCODE_PATTERN.test(second);
}

function isCompleteTikTokVideoUrl(url: URL): boolean {
  const hostname = normalizeHostname(url.hostname);
  const pathParts = splitPath(url.pathname);

  if (hostname === "vm.tiktok.com" || hostname === "vt.tiktok.com") {
    return pathParts.length > 0;
  }

  if (!hostname.endsWith("tiktok.com")) {
    return false;
  }

  if (pathParts.length < 3) {
    return false;
  }

  const [first = "", second = "", third = ""] = pathParts;
  return first.startsWith("@") && second === "video" && TIKTOK_VIDEO_ID_PATTERN.test(third);
}

export function getCompleteSupportedVideoUrlPlatform(input: string): SupportedVideoPlatform | null {
  const url = parseUrl(input);
  if (url == null) {
    return null;
  }

  if (isCompleteYouTubeVideoUrl(url)) {
    return "youtube";
  }

  if (isCompleteInstagramVideoUrl(url)) {
    return "instagram";
  }

  if (isCompleteTikTokVideoUrl(url)) {
    return "tiktok";
  }

  return null;
}

export function isCompleteSupportedVideoUrl(input: string): boolean {
  return getCompleteSupportedVideoUrlPlatform(input) != null;
}
