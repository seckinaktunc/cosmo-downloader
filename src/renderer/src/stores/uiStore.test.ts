import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_EXPORT_SETTINGS } from '../../../shared/defaults'
import { useUiStore } from './uiStore'

beforeEach(() => {
  useUiStore.setState({
    activeExportTarget: null,
    previewExportSettings: DEFAULT_EXPORT_SETTINGS,
    lastEditableExportSettings: DEFAULT_EXPORT_SETTINGS
  })
})

describe('useUiStore per-video export settings', () => {
  it('initializes preview settings from the last editable settings', () => {
    const lastSettings = { ...DEFAULT_EXPORT_SETTINGS, outputFormat: 'mkv' as const }
    useUiStore.getState().setLastEditableExportSettings(lastSettings)

    useUiStore.getState().initializePreviewExportSettings()

    expect(useUiStore.getState().activeExportTarget).toEqual({ type: 'preview' })
    expect(useUiStore.getState().previewExportSettings).toEqual(lastSettings)
  })

  it('updates preview settings without mutating the default object', () => {
    useUiStore.getState().initializePreviewExportSettings()

    const nextSettings = useUiStore.getState().updatePreviewExportSettings({
      outputFormat: 'webm'
    })

    expect(nextSettings.outputFormat).toBe('webm')
    expect(useUiStore.getState().lastEditableExportSettings.outputFormat).toBe('webm')
    expect(DEFAULT_EXPORT_SETTINGS.outputFormat).toBe('mp4')
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
