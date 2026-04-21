import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_EXPORT_SETTINGS } from '@shared/defaults'
import type { AppSettings, VideoMetadata } from '@shared/types'
import { useUiStore } from '@renderer/stores/uiStore'

const settings: AppSettings = {
  hardwareAcceleration: true,
  automaticUpdates: true,
  alwaysAskDownloadLocation: true,
  createFolderPerDownload: false,
  defaultDownloadLocation: 'C:\\Users\\me\\Downloads',
  lastDownloadDirectory: 'C:\\Users\\me\\Downloads',
  interfaceLanguage: 'en_US',
  cookiesBrowser: 'none',
  alwaysOnTop: false
}

function metadata(title: string, duration?: number): VideoMetadata {
  return {
    requestId: title,
    url: `https://example.com/${title}`,
    title,
    duration,
    containers: [],
    videoCodecs: [],
    audioCodecs: [],
    fpsOptions: [],
    formats: []
  }
}

beforeEach(() => {
  useUiStore.setState({
    activePanel: 'metadata',
    previousMediaPanel: 'metadata',
    activeExportTarget: null,
    previewExportSettings: DEFAULT_EXPORT_SETTINGS,
    lastEditableExportSettings: DEFAULT_EXPORT_SETTINGS
  })
})

describe('useUiStore media panel history', () => {
  it('restores the previous media panel when toggling the active panel closed', () => {
    useUiStore.getState().openMediaPanel('queue')

    expect(useUiStore.getState().activePanel).toBe('queue')

    useUiStore.getState().toggleMediaPanel('queue')

    expect(useUiStore.getState().activePanel).toBe('metadata')
  })

  it('keeps one-step history across queue and history panels', () => {
    useUiStore.getState().openMediaPanel('queue')
    useUiStore.getState().openMediaPanel('history')
    useUiStore.getState().closeMediaPanel()

    expect(useUiStore.getState().activePanel).toBe('queue')
  })
})

describe('useUiStore per-video export settings', () => {
  it('initializes preview settings from the last editable settings', () => {
    const lastSettings = { ...DEFAULT_EXPORT_SETTINGS, outputFormat: 'mkv' as const }
    useUiStore.getState().setLastEditableExportSettings(lastSettings)

    useUiStore.getState().initializePreviewExportSettings(metadata('New Video'), settings)

    expect(useUiStore.getState().activeExportTarget).toEqual({ type: 'preview' })
    expect(useUiStore.getState().previewExportSettings).toEqual({
      ...lastSettings,
      savePath: 'C:\\Users\\me\\Downloads\\New Video.mkv'
    })
  })

  it('updates preview settings without mutating the default object', () => {
    useUiStore.getState().initializePreviewExportSettings(metadata('New Video'), settings)

    const nextSettings = useUiStore.getState().updatePreviewExportSettings({
      outputFormat: 'webm'
    })

    expect(nextSettings.outputFormat).toBe('webm')
    expect(useUiStore.getState().lastEditableExportSettings.outputFormat).toBe('webm')
    expect(DEFAULT_EXPORT_SETTINGS.outputFormat).toBe('mp4')
  })

  it('keeps the previous Windows directory and uses the new metadata title as the filename', () => {
    useUiStore.getState().setLastEditableExportSettings({
      ...DEFAULT_EXPORT_SETTINGS,
      savePath: 'C:\\Downloads\\Old Video.mp4'
    })

    useUiStore.getState().initializePreviewExportSettings(metadata('New Video'), settings)

    expect(useUiStore.getState().previewExportSettings.savePath).toBe(
      'C:\\Downloads\\New Video.mp4'
    )
  })

  it('keeps the previous POSIX directory and selected output format', () => {
    useUiStore.getState().setLastEditableExportSettings({
      ...DEFAULT_EXPORT_SETTINGS,
      outputFormat: 'mkv',
      savePath: '/Users/me/Downloads/Old.webm'
    })

    useUiStore.getState().initializePreviewExportSettings(metadata('New Video'), {
      ...settings,
      defaultDownloadLocation: '/Users/me/Downloads',
      lastDownloadDirectory: '/Users/me/Downloads'
    })

    expect(useUiStore.getState().previewExportSettings.savePath).toBe(
      '/Users/me/Downloads/New Video.mkv'
    )
  })

  it('sanitizes the new metadata title before building the preview save path', () => {
    useUiStore.getState().setLastEditableExportSettings({
      ...DEFAULT_EXPORT_SETTINGS,
      savePath: 'C:\\Downloads\\Old Video.mp4'
    })

    useUiStore
      .getState()
      .initializePreviewExportSettings(metadata('New: Video? <Final>.'), settings)

    expect(useUiStore.getState().previewExportSettings.savePath).toBe(
      'C:\\Downloads\\New Video Final.mp4'
    )
  })

  it('clears inherited save paths when always ask for location is disabled', () => {
    useUiStore.getState().setLastEditableExportSettings({
      ...DEFAULT_EXPORT_SETTINGS,
      savePath: 'C:\\Downloads\\Old Video.mp4'
    })

    useUiStore.getState().initializePreviewExportSettings(metadata('New Video'), {
      ...settings,
      alwaysAskDownloadLocation: false
    })

    expect(useUiStore.getState().previewExportSettings.savePath).toBeUndefined()
  })

  it('keeps the new basename when output format changes', () => {
    useUiStore.getState().setLastEditableExportSettings({
      ...DEFAULT_EXPORT_SETTINGS,
      savePath: 'C:\\Downloads\\Old Video.mp4'
    })
    useUiStore.getState().initializePreviewExportSettings(metadata('New Video'), settings)

    useUiStore.getState().updatePreviewExportSettings({
      savePath: 'C:\\Downloads\\New Video.webm',
      outputFormat: 'webm'
    })

    expect(useUiStore.getState().previewExportSettings.savePath).toBe(
      'C:\\Downloads\\New Video.webm'
    )
  })

  it('resets trim to the new video duration instead of carrying previous trim bounds', () => {
    useUiStore.getState().setLastEditableExportSettings({
      ...DEFAULT_EXPORT_SETTINGS,
      trimStartSeconds: 15,
      trimEndSeconds: 45
    })

    useUiStore.getState().initializePreviewExportSettings(metadata('New Video', 180), settings)

    expect(useUiStore.getState().previewExportSettings.trimStartSeconds).toBe(0)
    expect(useUiStore.getState().previewExportSettings.trimEndSeconds).toBe(180)
  })

  it('does not clear queue or history targets when clearing preview state', () => {
    useUiStore.getState().setActiveExportTarget({ type: 'queue', itemId: 'queued' })

    useUiStore.getState().clearPreviewExportTarget()

    expect(useUiStore.getState().activeExportTarget).toEqual({
      type: 'queue',
      itemId: 'queued'
    })
  })
})
