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

type ExportSettingsTargetLabels = {
  queuedEditable: string
  queuedReadOnly: string
  historyReadOnly: string
  previewEditable: string
  unavailable: string
}

const DEFAULT_LABELS: ExportSettingsTargetLabels = {
  queuedEditable: 'Editing queued video settings',
  queuedReadOnly: 'Queue item settings are read-only',
  historyReadOnly: 'History settings are read-only',
  previewEditable: 'Editing preview video settings',
  unavailable: 'Select a video to edit export settings'
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
  historyEntries,
  labels = DEFAULT_LABELS
}: {
  activeTarget: ActiveExportTarget | null
  previewMetadata: VideoMetadata | null
  previewExportSettings: ExportSettings
  queueItems: QueueItem[]
  historyEntries: DownloadHistoryEntry[]
  labels?: ExportSettingsTargetLabels
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
        label: editable ? labels.queuedEditable : labels.queuedReadOnly
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
        label: labels.historyReadOnly
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
      label: labels.previewEditable
    }
  }

  return {
    target: null,
    metadata: null,
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    readOnly: true,
    editable: false,
    label: labels.unavailable
  }
}
