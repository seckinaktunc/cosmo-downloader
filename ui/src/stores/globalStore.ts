import { create } from "zustand";

type ExitAction = "close" | "minimize" | null;

interface GlobalStore {
    isVisible: boolean;
    exitAction: ExitAction;
    isPinned: boolean;
    isPreferencesOpen: boolean;
    isSettingsOpen: boolean;

    setExitAction: (exitAction: ExitAction) => void;
    setVisible: (isVisible: boolean) => void;
    togglePin: () => void;
    togglePreferences: () => void;
    toggleSettings: () => void;
}

export const useGlobalStore = create<GlobalStore>((set) => ({
    isVisible: false,
    exitAction: null,
    isPinned: false,
    isPreferencesOpen: false,
    isSettingsOpen: false,

    setVisible: (isVisible) => set({ isVisible: isVisible }),
    setExitAction: (exitAction) => set({ exitAction: exitAction }),
    togglePin: () => set((state) => {
        const newPinnedState = !state.isPinned;
        window.chrome?.webview?.postMessage(`set_pinned:${newPinnedState}`);
        return { isPinned: newPinnedState };
    }),

    togglePreferences: () => set((state) => ({
        isPreferencesOpen: !state.isPreferencesOpen,
        isSettingsOpen: false,
    })),

    toggleSettings: () => set((state) => ({
        isSettingsOpen: !state.isSettingsOpen,
        isPreferencesOpen: false,
    })),
}))