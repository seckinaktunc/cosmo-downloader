import { create } from 'zustand'
import { DEFAULT_EXPORT_SETTINGS } from '../../../shared/defaults'
import type { ExportSettings } from '../../../shared/types'

type MediaPanel = 'metadata' | 'queue' | 'history'
type Panel = MediaPanel | null
type Content = 'export' | 'settings' | null
export type ActiveExportTarget =
  | { type: 'preview' }
  | { type: 'queue'; itemId: string }
  | { type: 'history'; entryId: string }

type UiState = {
  activePanel: Panel
  previousMediaPanel: MediaPanel
  activeContent: Content
  activeExportTarget: ActiveExportTarget | null
  previewExportSettings: ExportSettings
  lastEditableExportSettings: ExportSettings
  mediaOverviewWidthPercent: number

  setActivePanel: (panel: Panel) => void
  openMediaPanel: (panel: MediaPanel) => void
  closeMediaPanel: () => void
  toggleMediaPanel: (panel: MediaPanel) => void
  setActiveContent: (panel: Content) => void
  setActiveExportTarget: (target: ActiveExportTarget | null) => void
  initializePreviewExportSettings: () => void
  clearPreviewExportTarget: () => void
  updatePreviewExportSettings: (update: Partial<ExportSettings>) => ExportSettings
  setLastEditableExportSettings: (settings: ExportSettings) => void
  setMediaOverviewWidthPercent: (width: number) => void
}

export const MEDIA_OVERVIEW_MIN_WIDTH = 30
export const MEDIA_OVERVIEW_MAX_WIDTH = 50

function clampMediaOverviewWidth(width: number): number {
  return Math.min(MEDIA_OVERVIEW_MAX_WIDTH, Math.max(MEDIA_OVERVIEW_MIN_WIDTH, width))
}

function normalizePanel(panel: Panel): MediaPanel {
  return panel ?? 'metadata'
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: 'metadata',
  previousMediaPanel: 'metadata',
  activeContent: 'export',
  activeExportTarget: null,
  previewExportSettings: DEFAULT_EXPORT_SETTINGS,
  lastEditableExportSettings: DEFAULT_EXPORT_SETTINGS,
  mediaOverviewWidthPercent: MEDIA_OVERVIEW_MIN_WIDTH,

  setActivePanel: (panel) => set({ activePanel: panel }),
  openMediaPanel: (panel) =>
    set((state) => ({
      activePanel: panel,
      previousMediaPanel:
        state.activePanel === panel ? state.previousMediaPanel : normalizePanel(state.activePanel)
    })),
  closeMediaPanel: () =>
    set((state) => ({
      activePanel: state.previousMediaPanel,
      previousMediaPanel: 'metadata'
    })),
  toggleMediaPanel: (panel) =>
    set((state) =>
      state.activePanel === panel
        ? {
            activePanel: state.previousMediaPanel,
            previousMediaPanel: 'metadata'
          }
        : {
            activePanel: panel,
            previousMediaPanel: normalizePanel(state.activePanel)
          }
    ),
  setActiveContent: (content) => set({ activeContent: content }),
  setActiveExportTarget: (target) => set({ activeExportTarget: target }),
  initializePreviewExportSettings: () =>
    set((state) => ({
      activeExportTarget: { type: 'preview' },
      previewExportSettings: state.lastEditableExportSettings
    })),
  clearPreviewExportTarget: () =>
    set((state) => ({
      activeExportTarget:
        state.activeExportTarget?.type === 'preview' ? null : state.activeExportTarget,
      previewExportSettings: state.lastEditableExportSettings
    })),
  updatePreviewExportSettings: (update) => {
    let nextSettings = DEFAULT_EXPORT_SETTINGS
    set((state) => {
      nextSettings = {
        ...state.previewExportSettings,
        ...update
      }
      return {
        previewExportSettings: nextSettings,
        lastEditableExportSettings: nextSettings
      }
    })
    return nextSettings
  },
  setLastEditableExportSettings: (settings) => set({ lastEditableExportSettings: settings }),
  setMediaOverviewWidthPercent: (width) =>
    set({ mediaOverviewWidthPercent: clampMediaOverviewWidth(width) })
}))
