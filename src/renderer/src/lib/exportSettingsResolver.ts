import { DEFAULT_EXPORT_SETTINGS } from '../../../shared/defaults'
import type {
  DownloadHistoryEntry,
  ExportSettings,
  QueueItem,
  QueueItemStatus,
  VideoMetadata
} from '../../../shared/types'
import type { ActiveExportTarget } from '../stores/uiStore'

export type ResolvedExportSettingsTarget = {
  target: ActiveExportTarget | null
  metadata: VideoMetadata | null
  exportSettings: ExportSettings
  readOnly: boolean
  editable: boolean
  label: string
}

export function isQueueExportEditable(status: QueueItemStatus): boolean {
  return (
    status === 'pending' || status === 'paused' || status === 'failed' || status === 'cancelled'
  )
}

export function resolveExportSettingsTarget({
  activeTarget,
  previewMetadata,
  previewExportSettings,
  queueItems,
  historyEntries
}: {
  activeTarget: ActiveExportTarget | null
  previewMetadata: VideoMetadata | null
  previewExportSettings: ExportSettings
  queueItems: QueueItem[]
  historyEntries: DownloadHistoryEntry[]
}): ResolvedExportSettingsTarget {
  if (activeTarget?.type === 'queue') {
    const item = queueItems.find((candidate) => candidate.id === activeTarget.itemId)
    if (item) {
      const editable = isQueueExportEditable(item.status)
      return {
        target: activeTarget,
        metadata: item.metadata,
        exportSettings: item.exportSettings,
        readOnly: !editable,
        editable,
        label: editable ? 'Editing queued video settings' : 'Queue item settings are read-only'
      }
    }
  }

  if (activeTarget?.type === 'history') {
    const entry = historyEntries.find((candidate) => candidate.id === activeTarget.entryId)
    if (entry) {
      return {
        target: activeTarget,
        metadata: entry.metadata,
        exportSettings: entry.exportSettings,
        readOnly: true,
        editable: false,
        label: 'History settings are read-only'
      }
    }
  }

  if (previewMetadata) {
    return {
      target: { type: 'preview' },
      metadata: previewMetadata,
      exportSettings: previewExportSettings,
      readOnly: false,
      editable: true,
      label: 'Editing preview video settings'
    }
  }

  return {
    target: null,
    metadata: null,
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    readOnly: true,
    editable: false,
    label: 'Select a video to edit export settings'
  }
}
