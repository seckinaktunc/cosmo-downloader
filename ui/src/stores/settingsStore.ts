import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isBrowserOptionValue, type BrowserOptionValue } from "@/constants/browserOptions";

export type LocaleCode = "tr_TR" | "en_US" | "zh_CN";
const FALLBACK_LANGUAGE: LocaleCode = "en_US";
const FALLBACK_BROWSER: BrowserOptionValue = "default";

function normalizeLanguage(value: unknown): LocaleCode {
    if (value === "en" || value === "en_US") return "en_US";
    if (value === "tr" || value === "tr_TR") return "tr_TR";
    if (value === "cn" || value === "zh_CN") return "zh_CN";

    return FALLBACK_LANGUAGE;
}

function normalizeBrowser(value: unknown): BrowserOptionValue {
    if (typeof value === "string" && isBrowserOptionValue(value)) {
        return value;
    }

    return FALLBACK_BROWSER;
}

function normalizeDirectoryPath(value: unknown): string {
    if (typeof value !== "string") {
        return "";
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : "";
}

interface SettingsStore {
    language: LocaleCode;
    browserForCookies: BrowserOptionValue;
    installedBrowsers: BrowserOptionValue[];
    hasLoadedInstalledBrowsers: boolean;
    alwaysAskDownloadDirectory: boolean;
    defaultDownloadDirectory: string;
    isDefaultDownloadDirectoryUserSet: boolean;
    hardwareAccelerationSupported: boolean;
    isHWACCELOn: boolean;
    autoCheckUpdates: boolean;

    setLanguage: (language: LocaleCode) => void;
    setBrowserForCookies: (browserForCookies: BrowserOptionValue) => void;
    setInstalledBrowsers: (installedBrowsers: BrowserOptionValue[]) => void;
    setDefaultDownloadDirectoryByUser: (defaultDownloadDirectory: string) => void;
    applySystemDefaultDownloadDirectory: (defaultDownloadDirectory: string) => void;
    setHardwareAccelerationSupported: (supported: boolean) => void;
    toggleAlwaysAskDownloadDirectory: () => void;
    toggleHWACCEL: () => void;
    toggleAutoCheckUpdates: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
    persist(
        (set) => ({
            language: "tr_TR",
            browserForCookies: "default",
            installedBrowsers: [],
            hasLoadedInstalledBrowsers: false,
            alwaysAskDownloadDirectory: false,
            defaultDownloadDirectory: "",
            isDefaultDownloadDirectoryUserSet: false,
            hardwareAccelerationSupported: true,
            isHWACCELOn: true,
            autoCheckUpdates: true,

            setLanguage: (language) => set({ language: language }),

            setBrowserForCookies: (browserForCookies) => set({
                browserForCookies: normalizeBrowser(browserForCookies),
            }),

            setInstalledBrowsers: (installedBrowsers) => set({
                installedBrowsers: Array.from(new Set(installedBrowsers)),
                hasLoadedInstalledBrowsers: true,
            }),

            toggleAlwaysAskDownloadDirectory: () => set((state) => ({
                alwaysAskDownloadDirectory: !state.alwaysAskDownloadDirectory,
            })),

            setDefaultDownloadDirectoryByUser: (defaultDownloadDirectory) => set((state) => {
                const normalized = normalizeDirectoryPath(defaultDownloadDirectory);
                if (normalized.length === 0) {
                    return state;
                }

                return {
                    defaultDownloadDirectory: normalized,
                    isDefaultDownloadDirectoryUserSet: true,
                };
            }),

            applySystemDefaultDownloadDirectory: (defaultDownloadDirectory) => set((state) => {
                if (state.isDefaultDownloadDirectoryUserSet) {
                    return state;
                }

                const normalized = normalizeDirectoryPath(defaultDownloadDirectory);
                if (normalized.length === 0 || normalized === state.defaultDownloadDirectory) {
                    return state;
                }

                return {
                    defaultDownloadDirectory: normalized,
                };
            }),

            setHardwareAccelerationSupported: (supported) => set((state) => ({
                hardwareAccelerationSupported: supported,
                isHWACCELOn: supported ? state.isHWACCELOn : false,
            })),

            toggleHWACCEL: () => set((state) => {
                if (!state.hardwareAccelerationSupported) {
                    return state;
                }

                return {
                    isHWACCELOn: !state.isHWACCELOn,
                };
            }),

            toggleAutoCheckUpdates: () => set((state) => ({
                autoCheckUpdates: !state.autoCheckUpdates,
            })),
        }),
        {
            name: "cosmo-settings",
            storage: createJSONStorage(() => localStorage),
            version: 3,
            migrate: (persistedState) => {
                const previous = (persistedState as Partial<SettingsStore> | undefined) ?? {};
                const normalizedDefaultDownloadDirectory = normalizeDirectoryPath(previous.defaultDownloadDirectory);
                const isDefaultDownloadDirectoryUserSet =
                    typeof previous.isDefaultDownloadDirectoryUserSet === "boolean"
                        ? previous.isDefaultDownloadDirectoryUserSet
                        : normalizedDefaultDownloadDirectory.length > 0;

                return {
                    ...previous,
                    language: normalizeLanguage(previous.language),
                    browserForCookies: normalizeBrowser(previous.browserForCookies),
                    defaultDownloadDirectory: normalizedDefaultDownloadDirectory,
                    isDefaultDownloadDirectoryUserSet: isDefaultDownloadDirectoryUserSet,
                };
            },
            partialize: (state) => ({
                language: state.language,
                browserForCookies: state.browserForCookies,
                alwaysAskDownloadDirectory: state.alwaysAskDownloadDirectory,
                defaultDownloadDirectory: state.defaultDownloadDirectory,
                isDefaultDownloadDirectoryUserSet: state.isDefaultDownloadDirectoryUserSet,
                isHWACCELOn: state.isHWACCELOn,
                autoCheckUpdates: state.autoCheckUpdates,
            }),
        },
    ),
)
