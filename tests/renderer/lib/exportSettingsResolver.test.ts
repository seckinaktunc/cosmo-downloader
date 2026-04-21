import { describe, expect, it } from 'vitest'
import { DEFAULT_EXPORT_SETTINGS } from '@shared/defaults'
import type {
  DownloadHistoryEntry,
  ExportSettings,
  QueueItem,
  QueueItemStatus,
  VideoMetadata
} from '@shared/types'
import {
  isQueueExportEditable,
  resolveExportSettingsTarget
} from '@renderer/lib/exportSettingsResolver'

const settings: ExportSettings = {
  ...DEFAULT_EXPORT_SETTINGS,
  outputFormat: 'mkv'
}

function metadata(title: string): VideoMetadata {
  return {
    requestId: title,
    url: `https://example.com/${title}`,
    title,
    containers: [],
    videoCodecs: [],
    audioCodecs: [],
    fpsOptions: [],
    formats: []
  }
}

function queueItem(id: string, status: QueueItemStatus, exportSettings = settings): QueueItem {
  return {
    id,
    metadata: metadata(id),
    exportSettings,
    settings: {
      hardwareAcceleration: true,
      automaticUpdates: true,
      alwaysAskDownloadLocation: false,
      createFolderPerDownload: false,
      defaultDownloadLocation: '/downloads',
      interfaceLanguage: 'en_US',
      cookiesBrowser: 'none',
      alwaysOnTop: false
    },
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

function historyEntry(id: string): DownloadHistoryEntry {
  const item = queueItem(id, 'completed')
  return {
    id,
    metadata: item.metadata,
    exportSettings: item.exportSettings,
    settings: item.settings,
    status: 'completed',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }
}

describe('exportSettingsResolver', () => {
  it('marks only retryable queue states as editable', () => {
    expect(isQueueExportEditable('pending')).toBe(true)
    expect(isQueueExportEditable('paused')).toBe(true)
    expect(isQueueExportEditable('failed')).toBe(true)
    expect(isQueueExportEditable('cancelled')).toBe(true)
    expect(isQueueExportEditable('active')).toBe(false)
    expect(isQueueExportEditable('completed')).toBe(false)
  })

  it('resolves preview settings when preview metadata exists', () => {
    const resolved = resolveExportSettingsTarget({
      activeTarget: { type: 'preview' },
      previewMetadata: metadata('preview'),
      previewExportSettings: settings,
      queueItems: [],
      historyEntries: []
    })

    expect(resolved.exportSettings).toBe(settings)
    expect(resolved.readOnly).toBe(false)
    expect(resolved.metadata?.title).toBe('preview')
  })

  it('resolves editable queue settings for pending items', () => {
    const item = queueItem('queued', 'pending')
    const resolved = resolveExportSettingsTarget({
      activeTarget: { type: 'queue', itemId: item.id },
      previewMetadata: metadata('preview'),
      previewExportSettings: DEFAULT_EXPORT_SETTINGS,
      queueItems: [item],
      historyEntries: []
    })

    expect(resolved.exportSettings).toBe(settings)
    expect(resolved.readOnly).toBe(false)
  })

  it('resolves read-only settings for history entries', () => {
    const entry = historyEntry('history')
    const resolved = resolveExportSettingsTarget({
      activeTarget: { type: 'history', entryId: entry.id },
      previewMetadata: metadata('preview'),
      previewExportSettings: DEFAULT_EXPORT_SETTINGS,
      queueItems: [],
      historyEntries: [entry]
    })

    expect(resolved.exportSettings).toBe(settings)
    expect(resolved.readOnly).toBe(true)
  })
})
