# Changelog

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
