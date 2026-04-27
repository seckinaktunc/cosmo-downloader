# Changelog

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
