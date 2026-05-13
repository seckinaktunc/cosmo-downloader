# Troubleshooting

Quick fixes for the most common issues. If none of these help, open an [issue](https://github.com/seckinaktunc/cosmo-downloader/issues) with a relevant log attached. Log paths are listed in [Where to find logs](#where-to-find-logs) below.

## Install and launch issues

### "Windows protected your PC" / SmartScreen warning

Expected if you downloaded an unsigned Windows build. Click **More info -> Run anyway**. Signed builds will stop prompting once enough users have installed them and Microsoft has built up reputation for the installer.

### macOS blocks the first launch

If macOS blocks the first launch after you drag the app into `Applications`:

1. Make sure you downloaded the correct DMG for your Mac: `-mac-arm64` for Apple Silicon or `-mac-x64` for Intel.
2. In `Applications`, right-click **Cosmo Downloader** and choose **Open** once.
3. If that still fails, allow the app from **System Settings > Privacy & Security** and launch it again.

### Antivirus flags the installer or `yt-dlp.exe`

Common false positive. `yt-dlp` is frequently flagged because malware sometimes uses it. Options:

- Whitelist the installed app directory.
- Whitelist the bundled binary at `<install-dir>\resources\bin\win32-x64\yt-dlp.exe`.
- Download directly from the official [Releases](https://github.com/seckinaktunc/cosmo-downloader/releases) page. Do not trust copies from anywhere else.

### I want uninstall to remove logs, caches, and temp files too

Use the optional **full cleanup** checkbox in the Windows uninstaller.

That cleanup removes Cosmo Downloader's app data, logs, caches, updater files, and temp remnants from Windows profile folders. It does **not** remove downloaded videos, audio files, or any other media in your chosen output folders.

## Download issues

### "Binary not found" or similar on launch

- **Installed from a release package:** reinstall. The required bundled binaries (`yt-dlp`, `Deno`, `ffmpeg`, and `ffprobe`) should always be present. If they are not, something went wrong during install.
- **Built from source:** re-run `npm run download:binaries:current` to restore the current platform's bundled toolchain.

### Download fails immediately

- Check that the URL is correct and reachable in a regular browser.
- Some sites require authentication. See the cookie browser option below.

### Download fails on a private / age-restricted / member-only video

You need cookies from a browser where you are already signed in.

1. In **Preferences**, pick your browser under the cookie source option.
2. Fully close that browser. Chromium-based browsers lock the cookie database while running.
3. Retry the download.

### "Cookies from browser" error

Almost always because the browser is still running. Close it completely and check for leftover processes in Task Manager on Windows or Activity Monitor on macOS, then try again.

### Download stuck at 99% for a long time

That is usually the FFmpeg remux or re-encode phase after `yt-dlp` finishes the raw download. For large videos or heavy codec conversions, this can take a while. Open the **Logs** tab to confirm FFmpeg is still working.

### Slow downloads

- Check your internet connection against a direct download from a browser.
- Some platforms throttle. The app cannot override that.
- Disabling hardware acceleration in Preferences can help if your GPU driver is unstable. Re-enabling it will speed up re-encodes.

### "Output file already exists"

Choose a different path or filename in **Export Settings**.

## Performance issues

### High CPU during downloads

Expected during FFmpeg encoding, especially for AV1 / H.265 / H.264 re-encodes. Enable **hardware acceleration** in Preferences if you have a modern GPU. Choosing `mkv` with `auto` codec avoids re-encoding entirely when `yt-dlp` can grab a compatible stream directly.

### App feels laggy

Check the **Logs** tab. If logs are growing very fast, a download is being especially chatty. Logs are compacted automatically.

## Updates

### Auto-update did not pick up a new version

- Check that **Preferences -> Check for updates automatically** is enabled.
- The app checks GitHub Releases. If your network blocks GitHub, auto-updates will not work and you will need to install manually from the [Releases](https://github.com/seckinaktunc/cosmo-downloader/releases) page.
- Restart the app. The automatic check runs on launch.

## Build from source

For the full local setup and packaging flow, see [Build from Source](BUILD_FROM_SOURCE.md).

### `npm install` fails on postinstall

The postinstall step runs `electron-builder install-app-deps`. On first install, this can fail on Windows if you have not enabled Developer Mode yet. Run `npm run preflight:win-symlink` for a specific diagnostic.

### `electron-builder` errors about symlinks on Windows

Enable **Developer Mode** in Windows (**Settings -> Privacy & security -> For developers**), then restart your shell. Alternatively, run your build shell as Administrator.

### `npm run build:mac:local` exits with missing notarization env vars

Create `.env.mac.local` from `.env.mac.local.example` and populate `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`, or export them in your shell before running the build. Keep the real signing certificate in macOS Keychain.

### Local build does not match the release build

Use the platform-specific local build commands:

- Windows: `npm run build:win:local`
- Linux: `npm run build:linux:local`
- macOS: `npm run build:mac:local`

The non-local packaging commands are CI-oriented and skip some local preparation steps.

## Where to find logs

- Windows app logs: `%APPDATA%\Cosmo Downloader\logs\`
- macOS app logs: `~/Library/Application Support/Cosmo Downloader/logs/`
- Linux app logs: `~/.config/Cosmo Downloader/logs/`
- Per-download logs: visible in the **Logs** tab inside the app
- Build logs (from source): console output from the relevant local build command

When filing an issue, attach the relevant log and mention your operating system, the app version (visible in Preferences), and the URL you were trying to download.
