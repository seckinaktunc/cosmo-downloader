import { create } from 'zustand'
import { DEFAULT_EXPORT_SETTINGS } from '../../../shared/defaults'
import type { ExportSettings } from '../../../shared/types'

type Panel = 'export' | 'settings' | null

type UiState = {
  activePanel: Panel
  exportSettings: ExportSettings
  mediaOverviewWidthPercent: number
  setActivePanel: (panel: Panel) => void
  updateExportSettings: (update: Partial<ExportSettings>) => void
  setMediaOverviewWidthPercent: (width: number) => void
}

export const MEDIA_OVERVIEW_MIN_WIDTH = 30
export const MEDIA_OVERVIEW_MAX_WIDTH = 50

function clampMediaOverviewWidth(width: number): number {
  return Math.min(MEDIA_OVERVIEW_MAX_WIDTH, Math.max(MEDIA_OVERVIEW_MIN_WIDTH, width))
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: 'export',
  exportSettings: DEFAULT_EXPORT_SETTINGS,
  mediaOverviewWidthPercent: MEDIA_OVERVIEW_MIN_WIDTH,
  setActivePanel: (panel) => set({ activePanel: panel }),
  updateExportSettings: (update) =>
    set((state) => ({
      exportSettings: {
        ...state.exportSettings,
        ...update
      }
    })),
  setMediaOverviewWidthPercent: (width) =>
    set({ mediaOverviewWidthPercent: clampMediaOverviewWidth(width) })
}))
