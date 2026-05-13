# Privacy Policy

*Last updated: 2026-05-13*

Cosmo Downloader is designed to be a **local-only tool**. This document explains what the app does and does not do with your data. It is written to match the actual behavior of the code, not marketing claims.

## TL;DR

- **No telemetry.** No analytics, no crash reporting, no SDKs phoning home.
- **No account required.** You never log in to us, because there is no "us" server.
- All your data (preferences, queue, history, logs) stays on your computer.

## What the app does NOT do

Cosmo Downloader does not:

- Collect, transmit, or store usage analytics.
- Bundle telemetry SDKs (no Sentry, PostHog, Google Analytics, Mixpanel, Amplitude, or anything similar).
- Send crash reports anywhere. Crashes are logged locally only.
- Require an account, login, or any form of registration.
- Sync any data to a remote server.
- Contain any advertising or tracking code.

## Network calls the app itself makes

The application initiates these specific network calls on your behalf:

1. **Update checks** - the app queries GitHub Releases for this repository to see if a newer version exists. You can disable auto-update in **Preferences**. Disabling it stops the check entirely.
2. **Thumbnail downloads** - when `yt-dlp` returns video metadata, the app may fetch the video's thumbnail image from whatever URL `yt-dlp` provided, usually the source platform's CDN. This only happens for URLs you add.

That is the full list.

## Network calls yt-dlp makes on your behalf

When you add a URL and start a download, the bundled `yt-dlp` binary makes the network requests required to resolve and retrieve that content. That typically means:

- Requests to the video platform you pasted (for example YouTube, TikTok, or Vimeo).
- Any follow-up requests `yt-dlp` needs, such as CDN requests or stream manifest lookups.

These requests are made by `yt-dlp` directly. The Cosmo UI does not proxy, inspect, or modify them. `yt-dlp` behavior is governed by its own project and documentation.

When `yt-dlp` needs a JavaScript runtime for site extraction, Cosmo supplies bundled Deno locally. That does not create a separate developer-facing network channel. It remains part of `yt-dlp`'s own retrieval flow.

## Local data stored on your machine

All user data lives under the Electron **userData** directory:

- Windows: `%APPDATA%\Cosmo Downloader\`
- macOS: `~/Library/Application Support/Cosmo Downloader/`
- Linux: `~/.config/Cosmo Downloader/`

Typical contents:

```text
settings.json  - your preferences (codec defaults, cookie source, update settings, etc.)
queue.json     - pending download queue, persisted across restarts
history.json   - completed download history
logs/          - per-download logs from yt-dlp and FFmpeg
```

While a download is running, the app also creates temporary working files under the OS temporary directory. These are cleaned up at the end of each job.

You can delete any of these files manually at any time. Preferences will reset to defaults; queue and history will be empty.

On Windows, uninstall preserves this data by default. If you explicitly select the uninstaller's optional full-cleanup step, it will also remove the app's legacy roaming folder, updater cache, and temp remnants. Downloaded media in your chosen output folders is never removed by uninstall.

## Cookies

If you opt in to **browser cookie import** in Preferences, usually to download age-gated or member-only content you already have access to, the selected browser's cookie store is read by **yt-dlp** using its `--cookies-from-browser` option, not by Cosmo. Cosmo simply passes your browser choice to `yt-dlp`.

Nothing about your cookies is transmitted to the developer of Cosmo Downloader. The cookies flow only from your browser -> `yt-dlp` -> the site you are downloading from.

## Downloaded files

Downloaded files end up in the system **Downloads** folder by default, or in whatever per-video path you choose in **Export Settings**. Those files are entirely yours. The app does not scan, upload, index, or share them.

## Third-party components

- [**yt-dlp**](https://github.com/yt-dlp/yt-dlp) - runs locally and initiates the network calls needed to reach the platforms you ask it to reach. Its privacy behavior is governed by the `yt-dlp` project.
- [**Deno**](https://deno.com/) - bundled local JavaScript runtime supplied to `yt-dlp` when needed. Cosmo does not use it as an independent network client.
- [**FFmpeg**](https://ffmpeg.org/) and `ffprobe` - run locally and perform media processing and inspection on your machine. They are not used as independent network clients in this app.
- [**Electron**](https://www.electronjs.org/) - the runtime. Electron itself does not phone home from within this app.

## Changes to this policy

If the app's data or network behavior changes, this file will be updated in the same commit. The version history is visible in the repository git log.

## Questions

Open an [issue](https://github.com/seckinaktunc/cosmo-downloader/issues) if anything in this document is unclear or appears to contradict observed app behavior.
