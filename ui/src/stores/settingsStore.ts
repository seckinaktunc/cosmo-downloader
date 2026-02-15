import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type LocaleCode = "tr_TR" | "en_US";
const FALLBACK_LANGUAGE: LocaleCode = "tr_TR";

function normalizeLanguage(value: unknown): LocaleCode {
    if (value === "en" || value === "en_US") {
        return "en_US";
    }

    if (value === "tr" || value === "tr_TR") {
        return "tr_TR";
    }

    return FALLBACK_LANGUAGE;
}

interface SettingsStore {
    language: LocaleCode;
    browserForCookies: string;
    alwaysAskDownloadDirectory: boolean;
    defaultDownloadDirectory: string;
    isHWACCELOn: boolean;
    autoCheckUpdates: boolean;

    setLanguage: (language: LocaleCode) => void;
    setBrowserForCookies: (browserForCookies: string) => void;
    setDefaultDownloadDirectory: (defaultDownloadDirectory: string) => void;
    toggleAlwaysAskDownloadDirectory: () => void;
    toggleHWACCEL: () => void;
    toggleAutoCheckUpdates: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            language: "tr_TR",
            browserForCookies: "default",
            alwaysAskDownloadDirectory: false,
            defaultDownloadDirectory: "",
            isHWACCELOn: true,
            autoCheckUpdates: true,

            setLanguage: (language) => set({ language: language }),

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
        }),
        {
            name: "cosmo-settings",
            storage: createJSONStorage(() => localStorage),
            version: 2,
            migrate: (persistedState) => {
                const previous = (persistedState as Partial<SettingsStore> | undefined) ?? {};
                return {
                    ...previous,
                    language: normalizeLanguage(previous.language),
                };
            },
            partialize: (state) => ({
                language: state.language,
                browserForCookies: state.browserForCookies,
                alwaysAskDownloadDirectory: state.alwaysAskDownloadDirectory,
                defaultDownloadDirectory: state.defaultDownloadDirectory,
                isHWACCELOn: state.isHWACCELOn,
                autoCheckUpdates: state.autoCheckUpdates,
            }),
        },
    ),
)
