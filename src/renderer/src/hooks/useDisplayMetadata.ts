import type { VideoMetadata } from '../../../shared/types'
import { useHistoryStore } from '../stores/historyStore'
import { useQueueStore } from '../stores/queueStore'
import { useUiStore } from '../stores/uiStore'
import { useVideoStore } from '../stores/videoStore'

export function useDisplayMetadata(): VideoMetadata | null {
  const previewMetadata = useVideoStore((state) => state.metadata)
  const activeExportTarget = useUiStore((state) => state.activeExportTarget)
  const queueItems = useQueueStore((state) => state.items)
  const historyEntries = useHistoryStore((state) => state.entries)

  if (previewMetadata) {
    return previewMetadata
  }

  if (activeExportTarget?.type === 'queue') {
    return queueItems.find((item) => item.id === activeExportTarget.itemId)?.metadata ?? null
  }

  if (activeExportTarget?.type === 'history') {
    return historyEntries.find((entry) => entry.id === activeExportTarget.entryId)?.metadata ?? null
  }

  return null
}
