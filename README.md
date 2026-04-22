<div align="center">

<img src="build/icon.png" alt="Cosmo Downloader" width="128" height="128" />

# Cosmo Downloader

A high-performance video downloader for power users who value speed and aesthetics.

[![Latest release](https://img.shields.io/github/v/release/seckinaktunc/cosmo-downloader?style=flat-square)](https://github.com/seckinaktunc/cosmo-downloader/releases)
[![Platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)](#installation)
[![License](https://img.shields.io/badge/license-Non--Commercial-orange?style=flat-square)](LICENSE)

<p align="center">
  <img src="docs/screenshots/main.png" alt="Export Settings" width="32%" />
  <img src="docs/screenshots/settings.png" alt="Preferences" width="32%" />
  <img src="docs/screenshots/logs.png" alt="Logs" width="32%" />
</p>
</div>

> **Currently Windows only.** macOS support is on the way and Linux is on the roadmap.

Cosmo Downloader wraps the raw power of **yt-dlp** and **FFmpeg** in a modern UI, giving you fine-grained control over codecs, bitrate, resolution, and more. No pay-walls, no ads, no shady bundled toolbars.

**Download the latest release:** https://github.com/seckinaktunc/cosmo-downloader/releases

## About

I started building this out of necessity and kept working on it out of passion. Every other video downloader I tried was either pay-walled, ad-filled, or barely worked. Now that I can reliably use it myself, I'm genuinely excited to finally share it with people.

If it helps you, that's enough for me. If you have ideas, issues, or want to contribute; please do.

- **Zero external installs:** yt-dlp and FFmpeg ship bundled
- **Local-only:** No telemetry, no analytics, no account required

## Features

### Downloading
- Paste any URL supported by yt-dlp (YouTube, TikTok, Instagram, Twitch, and [hundreds more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md))
- Video + audio or audio-only extraction
- Thumbnail download / copy
- Trim / clip with in and out timecodes

### Format & control
- **Currently supported formats:** `mp4`, `mkv`, `webm`, `mp3`, `wav`
- **Video codecs:** `av1`, `vp9`, `h265`, `h264`, or `auto`
- **Audio codecs:** `opus`, `vorbis`, `aac`, `mp3`, `wav`, or `auto`
- Resolution and bitrate selection (up to 4K/20mbps/320kbps)
- Hardware acceleration (if your system supports it)

### UX
- Sequential and fully editable download queue
- Persistent download history with re-queue option
- Live per-download log viewer
- Clipboard-aware URL intake
- Browser cookie import for age-restricted content (check [Supported Browsers](https://github.com/yt-dlp/yt-dlp/issues/11352#issuecomment-2438518560))
- Auto-update checks via GitHub Releases
- Configurable download location and filename rules

## Installation

1. Grab the latest `cosmo-downloader-<version>-setup.exe` from the [Releases](https://github.com/seckinaktunc/cosmo-downloader/releases) page.
2. Run the installer.
3. Launch **Cosmo Downloader** from the Start Menu or your desktop.

The app self-updates on launch when a new release is available (can be disabled in Preferences).

## Usage

1. Copy a video URL to your clipboard and let Cosmo pick it up automatically.
2. Pick your format, codec, resolution, and bitrate (or you can leave everything on auto).
3. Trim with in/out timecodes if you don't want to download the entire thing.
4. Hit **Start Download**. That's it.

See the [FAQ](docs/FAQ.md) for more.

## Architecture

Cosmo Downloader is a standard Electron app:

- **Electron main process:** Download orchestration, queue, history, preferences, updates
- **React + TypeScript + TailwindCSS** combination for UI
- **yt-dlp:** Platform extraction and media retrieval (bundled)
- **FFmpeg:** Encoding, remuxing, trimming (bundled)

State is managed with Zustand. IPC between main and renderer is fully typed. Tests are written in Vitest.

## Build from source

### Prerequisites

- **[Node.js](https://nodejs.org/) 22.x** and **npm**
- **[Git](https://git-scm.com/)**
- For Windows builds: **Developer Mode enabled** (or an Administrator shell) so `electron-builder` can create symlinks during packaging. The `preflight:win-symlink` script will tell you if this isn't set up.

### Get the code

```bash
git clone https://github.com/seckinaktunc/cosmo-downloader.git
cd cosmo-downloader
npm install
npm run download:binaries:current
```

`download:binaries:current` fetches yt-dlp and FFmpeg for your current platform into `resources/bin/<platform-arch>/`. This must run at least once before `dev` or any build. Use `npm run download:binaries` to fetch binaries for all platforms (useful for CI).

### Run in dev

```bash
npm run dev
```

Starts the app with hot-reload for the renderer.

### Build a Windows installer

```bash
npm run build:win:local
```

Runs the full pipeline: fetch binaries -> typecheck -> bundle -> preflight symlink check -> `electron-builder`. The installer lands in `dist/cosmo-downloader-<version>-setup.exe`.

> `build:win` (no `:local`) skips the preflight and binary-fetch steps - it's used by the CI workflow where those are handled separately. Use `build:win:local` for local builds.

### Code signing (optional)

For a signed installer, set these before building:

- `WIN_CSC_LINK` - base64-encoded `.pfx` certificate
- `WIN_CSC_KEY_PASSWORD` - its password

If either is missing, an unsigned installer is produced. You can sanity-check a signed artifact with `npm run verify:win-signing`.

### Other scripts

| Script | What it does |
|---|---|
| `npm run lint` | ESLint over the project |
| `npm run format` | Prettier write |
| `npm run typecheck` | Node + web TS projects |
| `npm run test` | Vitest (one-shot) |
| `npm run build:unpack` | Unpacked build for local inspection (no installer) |

## Roadmap

- [x] Electron + React architecture
- [x] FFmpeg integration
- [x] Export Settings UI & implementation
- [x] Preferences UI & implementation
- [x] Browser selection for cookies
- [x] Multi-platform downloader
- [x] Audio extraction
- [x] Thumbnail downloader
- [x] Queueing
- [x] Download history
- [x] Clipboard detection
- [ ] Subtitle support
- [x] Multi-language support
- [ ] macOS build
- [ ] Linux build

## Contributing

Issues and PRs welcome. For non-trivial changes, please open an issue first to discuss the approach before submitting a PR. Contributions are accepted under the same [license](LICENSE) as the project.

## License

Released under a **[Custom Non-Commercial License](LICENSE)**. Personal use and modification are permitted; commercial use requires prior written permission.

## More

- [Changelog](docs/CHANGELOG.md)
- [FAQ](docs/FAQ.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Disclaimer](docs/DISCLAIMER.md)
- [Privacy Policy](docs/PRIVACY.md)
- [Terms of Service](docs/TERMS.md)
- [Contact](https://www.seckinaktunc.com)
