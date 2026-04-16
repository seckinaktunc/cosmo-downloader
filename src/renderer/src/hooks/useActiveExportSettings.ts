import { useCallback, useMemo } from 'react'
import type { ExportSettings } from '../../../shared/types'
import { resolveExportSettingsTarget } from '../lib/exportSettingsResolver'
import { useHistoryStore } from '../stores/historyStore'
import { useQueueStore } from '../stores/queueStore'
import { useUiStore } from '../stores/uiStore'
import { useVideoStore } from '../stores/videoStore'

export function useActiveExportSettings(): ReturnType<typeof resolveExportSettingsTarget> & {
  updateExportSettings: (update: Partial<ExportSettings>) => Promise<void>
} {
  const activeTarget = useUiStore((state) => state.activeExportTarget)
  const previewExportSettings = useUiStore((state) => state.previewExportSettings)
  const updatePreviewExportSettings = useUiStore((state) => state.updatePreviewExportSettings)
  const setLastEditableExportSettings = useUiStore((state) => state.setLastEditableExportSettings)
  const metadata = useVideoStore((state) => state.metadata)
  const queueItems = useQueueStore((state) => state.items)
  const updateQueueExportSettings = useQueueStore((state) => state.updateExportSettings)
  const historyEntries = useHistoryStore((state) => state.entries)

  const resolved = useMemo(
    () =>
      resolveExportSettingsTarget({
        activeTarget,
        previewMetadata: metadata,
        previewExportSettings,
        queueItems,
        historyEntries
      }),
    [activeTarget, historyEntries, metadata, previewExportSettings, queueItems]
  )

  const updateExportSettings = useCallback(
    async (update: Partial<ExportSettings>): Promise<void> => {
      if (!resolved.editable) {
        return
      }

      const target = resolved.target
      if (target?.type === 'queue') {
        const item = queueItems.find((candidate) => candidate.id === target.itemId)
        if (!item) {
          return
        }

        const nextSettings = {
          ...item.exportSettings,
          ...update
        }
        await updateQueueExportSettings(item.id, nextSettings)
        setLastEditableExportSettings(nextSettings)
        return
      }

      const nextSettings = updatePreviewExportSettings(update)
      setLastEditableExportSettings(nextSettings)
    },
    [
      queueItems,
      resolved.editable,
      resolved.target,
      setLastEditableExportSettings,
      updatePreviewExportSettings,
      updateQueueExportSettings
    ]
  )

  return {
    ...resolved,
    updateExportSettings
  }
}
