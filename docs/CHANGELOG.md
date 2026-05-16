# Changelog

## v1.1.0

### Added

- Added a shared buffered JSON persistence utility for queue, history, and settings data.
- Added corrupt-file backup recovery for persisted queue, history, and settings files.
- Added a dedicated queue progress IPC event for lightweight per-item runtime updates.
- Added remove button on hover for history items.

### Changed

- Changed queue persistence so live download progress is kept in memory instead of being written to `queue.json`.
- Changed queue snapshots to carry structural queue state only, while runtime progress is tracked separately in the renderer.
- Changed queue, history, and settings writes to use batched async persistence with immediate flushes for critical state transitions and app shutdown.

### Fixed

- Fixed excessive queue disk writes and full queue snapshot broadcasts during active downloads.
- Fixed unnecessary queue rerenders by applying per-item runtime progress deltas instead of replacing the full queue state on every progress tick.
- Fixed preview download state so queued download progress no longer overrides standalone preview progress tracking.
- Fixed history selection so the location selector shows the saved path and filename in read-only mode.

## v1.0.9

### Added

- Added a more streamlined auto-updater with a splash screen on start-up.
- Added ripple effects to buttons when clicked.
- Added new and reusable, custom input components.
- Added maximum history items limit setting.
- Added pagination for history items loading.
- Added a shared cache limit setting.

### Changed

- Changed minimum window height to be responsive to export settings panel's height.
- Rewrote the button component to improve reusability and maintainability.
- Rewrote the location selector component to improve reusability and maintainability.
- Changed half transparent white colored backgrounds across all UI components to fixed gray colors to improve consistency.
- Adjusted disabled state of radio box and its options to improve consistency.

### Fixed

- Fixed the top-corner pin icon.
- Fixed the macOS header layout direction.
- Fixed tooltip layout breakage in edge cases.

### Removed

- Removed the startup auto-update confirmation step.
- Removed the "Always ask download location" setting and the old Downloads section in Preferences.
- Renamed the Preferences "Metadata" section to "Advanced".

## v1.0.8

### Fixed

- Fixed a macOS signed release regression that prevented the bundled `yt-dlp` binary from launching.
- Fixed macOS auto-update packaging so signed builds include the updater config file and resolve the correct architecture-specific release manifest.
- Fixed a macOS auto-update channel regression that requested the wrong architecture-specific manifest filename.

## v1.0.7

### Added

- Added MacOS release scripts.

### Fixed

- Fixed the layout issue with scrub previews of videos with different aspect ratios.

## v1.0.6

### Added

- Added clipboard metadata prefetch for copied web links, with instant reuse when previewing the same URL later.
- Added prefetch cache visibility and cache-clearing controls in Preferences.
- Added storyboard-based scrub previews and anchored timecodes while adjusting trim handles.
- Added drag-to-move support for the selected trim range.

### Changed

- Added the app icon, name and version to the header of Preferences.
- Reorganized Preferences into collapsible General, Downloads, and Metadata sections, with remembered section state between launches.
- Improved trim interaction so range adjustments feel more direct and preview feedback stays aligned to the active handle.
- Improved the styling of location selector.

### Fixed

- Fixed error tooltip's broken styling.

## v1.0.5

### Added

- Added MOV output support and ProRes video codec support.
- Added successful and failed states to fetch history entries.
- Added persistent history for resolved fetches.
- Added live logs for active fetches.
- Added platform badges across supported sources.
- Added hover-only remove actions for queue items.
- Added skip support for items in active queues.
- Added descriptive tooltips for export settings options.
- Added selectable video descriptions in the metadata panel.
- Added Linux x64 AppImage releases.
- Added optional uninstall cleanup for app data, caches, logs, updater files, and temp remnants.
- Added export compatibility checks to help catch unsupported combinations earlier.

### Changed

- Adjusted the minimum window size for a more stable layout.
- Improved the overall layout and UI polish across the app.
- Improved tooltip presentation with tails and better positioning.
- Updated the bundled runtime stack with Deno behind the scenes to improve fetch and download reliability.
- Improved installer and uninstaller behavior on Windows.
- Reduced packaged app size with leaner bundled assets.

### Fixed

- Fixed Windows installer launch reliability.
- Fixed fetch and download flows so external `yt-dlp` config no longer causes unpredictable behavior.
- Fixed Linux packaging and release flow reliability for AppImage builds.
- Fixed history and logging flow issues around active and resolved fetches.

## v1.0.4

### Added

- Added Turkish and Simplified Chinese interface locales.
- Added flag icons to the language dropdown.
- Added a scroll-to-bottom button to Export Settings, matching the Logs tab behavior.
- Added changelog-based GitHub release notes automation.

### Changed

- Renamed the Settings tab to Preferences.
- Renamed the Export tab to Export Settings.
- Moved long-form project documentation into the `docs/` folder.
- Shared bottom-scroll logic between Logs and Export Settings.

### Fixed

- Changing the export download location for a freshly fetched video no longer refetches metadata or resets the custom output filename.
- Metadata auto-fetch now only reacts to URL changes and cookie-browser changes.
- Fixed language dropdown flag icon rendering.
- Hardened Windows zip extraction by passing PowerShell paths as arguments instead of interpolating them into command strings.

### Removed

- Removed drag-and-drop URL handling from the metadata overview panel.
- Removed unused drag/drop URL helpers and tests.
- Removed duplicate and unused locale keys.
