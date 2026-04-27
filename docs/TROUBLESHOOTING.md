# Troubleshooting

Quick fixes for the most common issues. If none of these help, open an [issue](https://github.com/seckinaktunc/cosmo-downloader/issues) with a log attached — you'll find the log file at `%APPDATA%\Cosmo Downloader\logs\` on Windows.

## Installer issues

### "Windows protected your PC" / SmartScreen warning

Expected if you downloaded an unsigned build. Click **More info → Run anyway**. Signed builds will stop prompting this once enough users have installed them (Microsoft's reputation system).

### Antivirus flags the installer or `yt-dlp.exe`

Common false positive — yt-dlp is frequently flagged because malware sometimes uses it. Options:

- Whitelist the installed app directory.
- Whitelist the bundled binary at `<install-dir>\resources\bin\win32-x64\yt-dlp.exe`.
- Download directly from the official [Releases](https://github.com/seckinaktunc/cosmo-downloader/releases) page (don't trust copies from anywhere else).

### I want uninstall to remove logs, caches, and temp files too

Use the optional **full cleanup** checkbox in the Windows uninstaller.

That cleanup removes Cosmo Downloader's app data, logs, caches, updater files, and temp remnants from Windows profile folders. It does **not** remove downloaded videos, audio files, or any other media in your chosen output folders.

## Download issues

### "Binary not found" or similar on launch

- **Installed from the installer:** reinstall. The required bundled binaries (`yt-dlp`, `Deno`, `ffmpeg`, and `ffprobe`) should always be present; if they're not, something went wrong during install.
- **Built from source:** re-run `npm run download:binaries:current` to restore the current platform's bundled toolchain.

### Download fails immediately

- Check the URL is correct and reachable in a regular browser.
- Some sites require authentication — see the cookie browser option below.

### Download fails on a private / age-restricted / member-only video

You need cookies from a browser where you're already signed in.

1. In **Preferences**, pick your browser under the cookie source option.
2. **Fully close** that browser (Chromium-based browsers lock the cookie database while running).
3. Retry the download.

### "Cookies from browser" error

Almost always because the browser is still running. Close it completely (check Task Manager for leftover `chrome.exe` / `msedge.exe` / etc.) and try again.

### Download stuck at 99% for a long time

That's the FFmpeg remux or re-encode phase after yt-dlp finishes the raw download. For large videos or heavy codec conversions (e.g., AV1 without hardware acceleration), this can take a while. Open the **Logs** tab to confirm FFmpeg is actively working.

### Slow downloads

- Check your internet connection against a direct download from a browser.
- Some platforms throttle — there's nothing the app can do about that.
- Disabling hardware acceleration in Preferences can help if your GPU driver is unstable; re-enabling it will speed up re-encodes.

### "Output file already exists"

Choose a different path in Export Settings.

## Performance issues

### High CPU during downloads

Expected during FFmpeg encoding, especially for AV1 / H.265 / H.264 re-encodes. Enable **hardware acceleration** in Preferences if you have a modern GPU. Choosing `mkv` with `auto` codec avoids re-encoding entirely when yt-dlp can grab a compatible stream directly.

### App feels laggy

Check the **Logs** tab — if logs are growing very fast, a download is very chatty. Logs are compacted automatically.

## Updates

### Auto-update didn't pick up a new version

- Check **Preferences → Check for updates automatically** is enabled.
- The app checks GitHub Releases; if your network blocks GitHub, auto-updates won't work. Install manually from the [Releases](https://github.com/seckinaktunc/cosmo-downloader/releases) page.
- Restart the app — the check runs on launch.

## Build from source

### `npm install` fails on postinstall

The postinstall step runs `electron-builder install-app-deps`. On first install, this can fail if you haven't set up Windows developer mode yet. Run `npm run preflight:win-symlink` for a specific diagnostic.

### `electron-builder` errors about symlinks on Windows

Enable **Developer Mode** in Windows (Windows Settings → Privacy & security → For developers), then restart your shell. Alternatively, run your build shell as Administrator.

### Local build doesn't match the release build

Use `npm run build:win:local`, not `npm run build:win`. The `:local` variant runs the full pipeline (binaries, typecheck, preflight, packaging). The non-local variant is intended for CI where those steps happen separately.

## Where to find logs

- **App logs:** `%APPDATA%\Cosmo Downloader\logs\` (Windows)
- **Per-download logs:** visible in the **Logs** tab inside the app
- **Build logs (from source):** console output of the `build:win:local` command

When filing an issue, attach the relevant log and mention your Windows version, the app version (visible in Preferences), and the URL you were trying to download.
