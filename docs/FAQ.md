# Frequently Asked Questions

## What sites does Cosmo Downloader support?

Anywhere yt-dlp can reach.

YouTube, TikTok, Instagram, Twitch, Twitter/X, Vimeo, Reddit, SoundCloud, and [hundreds more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md). If yt-dlp supports it, Cosmo supports it.

## Why is my download failing for a private or age-restricted video?

You probably need to pass cookies from a browser that's already logged in. In **Preferences**, pick the browser you're signed in with (check [Supported Browsers](https://github.com/yt-dlp/yt-dlp/issues/11352#issuecomment-2438518560)) under the cookie source option, then retry the download.

Make sure the selected browser is fully closed before downloading. Some browsers lock the cookie database while running.

## Where are my downloads saved?

By default, to your system **Downloads** folder. You can change the default in **Preferences > Default download location**, or choose a per-video location in **Export Settings**.

## Does uninstall delete my downloads or app data?

By default, uninstall removes the app and its shortcuts, but preserves your settings, history, logs, caches, and downloaded media.

If you want a full cleanup, the Windows uninstaller also offers an optional cleanup step that removes Cosmo Downloader's app data, updater cache, and temp remnants. Downloaded media and any other files in your chosen output folders are never removed by uninstall.

## Can I download audio only?

Yes. Just pick an audio-only format (`mp3`, `wav`). Cosmo will extract and encode audio directly. No video processing overhead.

## Can I trim a clip instead of downloading the full video?

Yes. Set the in and out timecodes in the export panel before starting the download. Cosmo hands those off to FFmpeg to cut the clip.

## Can I queue multiple downloads?

Yes. Queued items are processed sequentially. You can pause, reorder, or remove items while the queue is running. The queue survives app restarts.

## Where's my download history?

The **History** tab. You can re-queue any past download with a click, or copy the source URL back to clipboard.

## Why don't I see subtitles yet?

Subtitle support is on the [roadmap](README.md#roadmap) but not yet implemented.

## Is there a macOS or Linux version?

Linux x64 builds are available on the [Releases](https://github.com/seckinaktunc/cosmo-downloader/releases) page as AppImages. A macOS build is still being prepared.

## Does it work offline?

No, it can't. The source site needs to be reachable. Everything else (yt-dlp, FFmpeg, the UI) runs locally on your own machine.

## Does Cosmo Downloader collect or upload any of my data?

No. No telemetry, no analytics, no account. See [PRIVACY.md](PRIVACY.md) for the full breakdown of what the app does and doesn't do on the network.

## Will it download DRM-protected content?

No. Cosmo is a wrapper around yt-dlp and FFmpeg and doesn't bypass DRM or other technical protection measures. If yt-dlp can't retrieve the stream, Cosmo can't either.

## Does it support playlists?

No. Currently. Normally yt-dlp supports playlists, but Cosmo will need a little bit more time to have playlist support. Not a lot, just a little bit more.

## How do I update Cosmo Downloader?

The app checks for updates automatically on launch. When a new release is available, you'll get a prompt to install it. You can also disable auto-updates in **Preferences** and check updates yourself by clicking **Check for updates**.

## Why is my download stuck at 99%?

It's almost certainly in the FFmpeg remux / encode phase, which happens after yt-dlp finishes the raw download. Large videos or heavy re-encodes can take a while. Open the **Logs** tab to see live progress. Feel free to share them with me so we can solve the issue together.

## Can I use Cosmo Downloader commercially?

Not without written permission. See the [LICENSE](../LICENSE) for details. For commercial licensing, open an [issue](https://github.com/seckinaktunc/cosmo-downloader/issues).

## Still stuck?

Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md), or open an [issue](https://github.com/seckinaktunc/cosmo-downloader/issues) with the relevant log from the **Logs** tab attached.
