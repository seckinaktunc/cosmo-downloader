import { create } from "zustand";

interface SettingsStore {
    browserForCookies: string;
    alwaysAskDownloadDirectory: boolean;
    defaultDownloadDirectory: string;
    isHWACCELOn: boolean;
    autoCheckUpdates: boolean;

    setBrowserForCookies: (browserForCookies: string) => void;
    setDefaultDownloadDirectory: (defaultDownloadDirectory: string) => void;
    toggleAlwaysAskDownloadDirectory: () => void;
    toggleHWACCEL: () => void;
    toggleAutoCheckUpdates: () => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
    browserForCookies: "default",
    alwaysAskDownloadDirectory: false,
    defaultDownloadDirectory: "",
    isHWACCELOn: true,
    autoCheckUpdates: true,

    setBrowserForCookies: (browserForCookies) => set({
        browserForCookies: browserForCookies
    }),

    toggleAlwaysAskDownloadDirectory: () => set((state) => ({
        alwaysAskDownloadDirectory: !state.alwaysAskDownloadDirectory,
    })),

    setDefaultDownloadDirectory: (defaultDownloadDirectory) => set({
        defaultDownloadDirectory: defaultDownloadDirectory
    }),

    toggleHWACCEL: () => set((state) => ({
        isHWACCELOn: !state.isHWACCELOn,
    })),

    toggleAutoCheckUpdates: () => set((state) => ({
        autoCheckUpdates: !state.autoCheckUpdates,
    })),
}))