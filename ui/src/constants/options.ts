export const VIDEO_RES_OPTIONS = [
    { value: 360, label: "360p" },
    { value: 480, label: "480p" },
    { value: 720, label: "720p" },
    { value: 1080, label: "1080p" },
    { value: 1440, label: "2K" },
    { value: 2160, label: "4K" },
] as const;

export const VIDEO_FPS_OPTIONS = [
    { value: 24, label: "24 FPS" },
    { value: 30, label: "30 FPS (Standart)" },
    { value: 60, label: "60 FPS" },
    { value: 120, label: "120 FPS" },
] as const;

export const AUDIO_BITRATE_OPTIONS = [
    { value: 64, label: "64 kbps" },
    { value: 128, label: "128 kbps" },
    { value: 192, label: "192 kbps" },
    { value: 256, label: "256 kbps" },
    { value: 320, label: "320 kbps" },
] as const;

export const FORMAT_OPTIONS = [
    { value: "mp4", label: "MP4", helper: "En yaygın video" },
    { value: "mkv", label: "MKV", helper: "Kayıpsız video" },
    { value: "webm", label: "WebM", helper: "Düşük boyut" },
    { value: "mp3", label: "MP3", helper: "En yaygın ses" },
    { value: "wav", label: "WAV", helper: "Kayıpsız ses" },
] as const;