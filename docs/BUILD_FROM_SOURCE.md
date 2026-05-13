# Build from Source

This guide covers local development and packaging for Windows, Linux, and macOS.

## Prerequisites

- **[Node.js](https://nodejs.org/) 22.x** and **npm**
- **[Git](https://git-scm.com/)**
- For Windows builds: **Developer Mode enabled** (or an Administrator shell) so `electron-builder` can create symlinks during packaging. The `preflight:win-symlink` script will tell you if this is not set up.
- For macOS release builds: run the release packaging steps on macOS.

## Get the code

```bash
git clone https://github.com/seckinaktunc/cosmo-downloader.git
cd cosmo-downloader
npm install
npm run download:binaries:current
```

`download:binaries:current` fetches `yt-dlp`, `Deno`, `ffmpeg`, and `ffprobe` for your current platform into `resources/bin/<platform-arch>/`. Run it at least once before `dev` or any build. Use `npm run download:binaries` to fetch binaries for all supported platforms when you need a CI-style workspace.

## Run in dev

```bash
npm run dev
```

Starts the app with hot reload for the renderer.

## Local builds

### Windows installer

```bash
npm run build:win:local
```

Runs the full pipeline: fetch binaries -> typecheck -> bundle -> preflight symlink check -> `electron-builder`. The installer lands in `dist/cosmo-downloader-<version>-setup.exe`.

> `build:win` (no `:local`) skips the preflight and binary fetch steps. It is intended for CI, where those are handled separately.

### Linux AppImage (x64)

```bash
npm run build:linux:local
```

Runs the full Linux packaging flow: fetch binaries -> typecheck -> bundle -> `electron-builder` AppImage x64 packaging.

> `build:linux` (no `:local`) is the CI-oriented packaging command. Use `build:linux:local` for local release builds.

### macOS release

```bash
npm run build:mac:local
```

Runs the full macOS release flow on a Mac: fetch binaries for the current Mac architecture -> typecheck -> bundle -> `electron-builder` -> verify signing, Gatekeeper acceptance, and stapled notarization tickets.

Before running it, create a local `.env.mac.local` from `.env.mac.local.example` and populate:

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
- optional `CSC_NAME`

The local script merges `.env.mac.local` into the current shell environment without overriding already exported values. Keep the real signing certificate in macOS Keychain.

> `build:mac` (no `:local`) is the CI-oriented packaging command. Use `build:mac:local` for local notarized release builds.

## Signing and notarization

### Windows code signing (optional)

For a signed installer, set these before building:

- `WIN_CSC_LINK` - base64-encoded `.pfx` certificate
- `WIN_CSC_KEY_PASSWORD` - the certificate password

If either is missing, an unsigned installer is produced. You can sanity-check a signed artifact with `npm run verify:win-signing`.

### macOS release secrets

For local notarized Mac builds, use `.env.mac.local` with Apple ID credentials.

For GitHub Actions macOS release jobs, configure these repository secrets:

- `CSC_LINK` - base64-encoded `.p12` export of the `Developer ID Application` certificate
- `CSC_KEY_PASSWORD` - password used when exporting that `.p12`
- `APPLE_API_KEY_P8` - App Store Connect Team API key contents
- `APPLE_API_KEY_ID` - App Store Connect API key ID
- `APPLE_API_ISSUER` - App Store Connect issuer UUID

Mac release uploads are split by architecture for manual downloads:

- native `arm64` DMG/ZIP
- native `x64` DMG/ZIP

Mac in-app auto-updates are also split by architecture:

- `latest-arm64-mac.yml`
- `latest-x64-mac.yml`

Older shipped Mac builds that still expect `latest-mac.yml` will need a one-time manual reinstall to pick up the new updater channel layout.

## Other scripts

| Script                   | What it does                                                 |
| ------------------------ | ------------------------------------------------------------ |
| `npm run lint`           | ESLint over the project                                      |
| `npm run format`         | Prettier write                                               |
| `npm run release:public` | Prepare, tag, and trigger the public GitHub release workflow |
| `npm run typecheck`      | Node + web TS projects                                       |
| `npm run test`           | Vitest (one-shot)                                            |
| `npm run build:unpack`   | Unpacked build for local inspection (no installer)           |
