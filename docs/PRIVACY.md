# Privacy Policy

*Last updated: 2026-04-22*

Cosmo Downloader is designed to be a **local-only tool**. This document explains exactly what the app does and does not do with your data. It is written to match the actual behavior of the code — not marketing claims.

## TL;DR

- **No telemetry.** No analytics, no crash reporting, no SDKs phoning home.
- **No account required.** You never log in to us, because there is no "us" server.
- All your data (preferences, queue, history, logs) stays on your computer.

## What the app does NOT do

Cosmo Downloader does not:

- Collect, transmit, or store usage analytics.
- Bundle telemetry SDKs (no Sentry, PostHog, Google Analytics, Mixpanel, Amplitude, or anything similar).
- Send crash reports anywhere — crashes are logged locally only.
- Require an account, login, or any form of registration.
- Sync any data to a remote server.
- Contain any advertising or tracking code.

## Network calls the app itself makes

The application initiates these specific network calls on your behalf:

1. **Update checks** — the app queries the GitHub Releases API for your own repo to see if a newer version exists. You can disable auto-update in **Preferences**. Disabling it stops the check entirely.
2. **Thumbnail downloads** — when yt-dlp returns video metadata, the app may fetch the video's thumbnail image from whatever URL yt-dlp provided (usually the source platform's CDN). This only happens for URLs you add.

That's the full list.

## Network calls yt-dlp makes on your behalf

When you add a URL and start a download, the bundled yt-dlp binary makes the network requests required to resolve and retrieve that content. That typically means:

- Requests to the video platform you pasted (e.g., YouTube, TikTok).
- Any follow-up requests yt-dlp needs (e.g., to a CDN, or to extract stream manifests).

These requests are made by yt-dlp directly - the Cosmo UI does not proxy, inspect, or modify them. yt-dlp's behavior is governed by its own project and documentation.

When yt-dlp needs a JavaScript runtime for site extraction, Cosmo supplies bundled Deno locally. That does not create a separate developer-facing network channel; it remains part of yt-dlp's own retrieval flow.

## Local data stored on your machine

All user data lives under the Electron **userData** directory. On Windows:

```
%APPDATA%\Cosmo Downloader\
├── settings.json     — your preferences (download location, codec defaults, cookie source, etc.)
├── queue.json        — pending download queue, persisted across restarts
├── history.json      — completed download history
└── logs\             — per-download logs (stdout / stderr from yt-dlp and FFmpeg)
```

In addition, while a download is running, the app creates temporary working files under the OS temporary directory. These are cleaned up at the end of each job.

You can delete any of these files manually at any time. Preferences will reset to defaults; queue and history will be empty.

On Windows, uninstall preserves this data by default. If you explicitly select the uninstaller's optional full-cleanup step, it will also remove the app's legacy roaming folder, updater cache, and temp remnants. Downloaded media in your chosen output folders is never removed by uninstall.

## Cookies

If you opt in to **browser cookie import** in Preferences — typically to download age-gated or paywalled content you have access to — the selected browser's cookie store is read by **yt-dlp** (using its `--cookies-from-browser` option), *not* by Cosmo. Cosmo simply passes your browser choice to yt-dlp.

Nothing about your cookies is transmitted to the developer of Cosmo Downloader. The cookies flow only from your browser → yt-dlp → the site you're downloading from.

## Downloaded files

The files you download end up wherever you set the download location (Preferences → Default download location, defaulting to your system Downloads folder, or a per-video Export Settings path). Those files are entirely yours — the app does not scan, upload, index, or share them.

## Third-party components

- [**yt-dlp**](https://github.com/yt-dlp/yt-dlp) - runs locally, initiates network calls to the platforms you ask it to reach. Its privacy behavior is governed by the yt-dlp project.
- [**Deno**](https://deno.com/) - bundled local JavaScript runtime supplied to yt-dlp when needed. Cosmo does not use it as an independent network client.
- [**FFmpeg**](https://ffmpeg.org/) and `ffprobe` - run locally, perform media processing and inspection on your machine. They do not make network calls in the way Cosmo uses them.
- [**Electron**](https://www.electronjs.org/) — the runtime. Electron itself does not phone home from within this app.

## Changes to this policy

If the app's data or network behavior ever changes, this file will be updated in the same commit. The version history is visible in the repository's git log.

## Questions

Open an [issue](https://github.com/seckinaktunc/cosmo-downloader/issues) if anything in this document is unclear or appears to contradict observed app behavior.
