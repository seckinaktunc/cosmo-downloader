import { create } from 'zustand'
import { DEFAULT_EXPORT_SETTINGS } from '../../../shared/defaults'
import type { ExportSettings } from '../../../shared/types'

type Panel = 'metadata' | 'queue' | 'history' | null
type Content = 'export' | 'settings' | null

type UiState = {
  activePanel: Panel
  activeContent: Content
  exportSettings: ExportSettings
  mediaOverviewWidthPercent: number

  setActivePanel: (panel: Panel) => void
  setActiveContent: (panel: Content) => void
  updateExportSettings: (update: Partial<ExportSettings>) => void
  setMediaOverviewWidthPercent: (width: number) => void
}

export const MEDIA_OVERVIEW_MIN_WIDTH = 30
export const MEDIA_OVERVIEW_MAX_WIDTH = 50

function clampMediaOverviewWidth(width: number): number {
  return Math.min(MEDIA_OVERVIEW_MAX_WIDTH, Math.max(MEDIA_OVERVIEW_MIN_WIDTH, width))
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: 'metadata',
  activeContent: 'export',
  exportSettings: DEFAULT_EXPORT_SETTINGS,
  mediaOverviewWidthPercent: MEDIA_OVERVIEW_MIN_WIDTH,

  setActivePanel: (panel) => set({ activePanel: panel }),
  setActiveContent: (content) => set({ activeContent: content }),
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
