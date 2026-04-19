# Cosmo Downloader
**Cosmo Downloader** is a high-performance video downloader designed for power users who value speed and aesthetics.
It combines the raw power of **yt-dlp** and **FFmpeg** with a sleek user interface.

Designed to stay fast, minimal, and lightweight. No more pay-walled apps that barely work;
Cosmo Downloader is an all-in-one power-house of a video downloader.

I've started to build this out of necessity and kept developing out of passion for creating something useful.
Very excited and happy to be finally able to share this with other people.

Please feel free to suggest anything or contribute!

Download and try now: https://github.com/seckinaktunc/cosmo-downloader/releases

> **Currently only available for Windows**

## Features
- **Hybrid Architecture:** Native C++ performance meets modern Web UI design.
- **Lightweight:** Uses system's WebView2 (Edge) instead of bundling a full browser engine like Electron.
- **Advanced Control:** Full control over codecs, bitrate, framerate, and resolutions via FFmpeg.
- **Smart Parsing:** Paste a link and let the internal engine handle the rest.
<br>

## Architecture & Dependencies
Cosmo Downloader is built using **Electron** for the heavy lifting and **React (TypeScript)** for the user interface.
The application handles the orchestration of external tools automatically.

- **Electron Core** — Application logic, process management, and native system integration.
- **React + TailwindCSS** — A modern, reactive user interface.
- **yt-dlp** — Platform extraction & media handling (managed internally).
- **FFmpeg** — Encoding, remuxing, and processing (managed internally).
<br>

## To-Do
- [x] Electron + React architecture
- [x] FFmpeg integration
- [x] Export UI & implementation
- [x] Settings UI & implementation
- [x] Browser selection for cookies
- [x] Multi-platform downloader
- [x] Audio extraction
- [x] Thumbnail downloader
- [x] Queueing
- [x] Download history
- [x] Clipboard detection
- [ ] Subtitle support
- [ ] Multi-language support
- [ ] MacOS build
- [ ] Linux build
<br>

## Build Instructions

### Prerequisites
- **Node.js & npm** (For building the UI)
- **Git**

### Building
--WIP--