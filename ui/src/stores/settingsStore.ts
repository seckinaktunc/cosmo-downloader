import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isBrowserOptionValue, type BrowserOptionValue } from "@/constants/browserOptions";

export type LocaleCode = "tr_TR" | "en_US" | "zh_CN";
const FALLBACK_LANGUAGE: LocaleCode = "en_US";
const FALLBACK_BROWSER: BrowserOptionValue = "default";
const FALLBACK_HARDWARE_ACCELERATION_MODE = "none";

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

function normalizeHardwareAccelerationMode(value: unknown): string {
    if (typeof value !== "string") {
        return FALLBACK_HARDWARE_ACCELERATION_MODE;
    }

    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : FALLBACK_HARDWARE_ACCELERATION_MODE;
}

function normalizeHardwareAccelerationOptions(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [FALLBACK_HARDWARE_ACCELERATION_MODE];
    }

    const normalized = Array.from(
        new Set(
            value
                .filter((item): item is string => typeof item === "string")
                .map((item) => item.trim().toLowerCase())
                .filter((item) => item.length > 0),
        ),
    );

    if (!normalized.includes(FALLBACK_HARDWARE_ACCELERATION_MODE)) {
        normalized.unshift(FALLBACK_HARDWARE_ACCELERATION_MODE);
    }

    return normalized;
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
    hardwareAccelerationOptions: string[];
    hardwareAccelerationMode: string;
    autoCheckUpdates: boolean;

    setLanguage: (language: LocaleCode) => void;
    setBrowserForCookies: (browserForCookies: BrowserOptionValue) => void;
    setInstalledBrowsers: (installedBrowsers: BrowserOptionValue[]) => void;
    setDefaultDownloadDirectoryByUser: (defaultDownloadDirectory: string) => void;
    applySystemDefaultDownloadDirectory: (defaultDownloadDirectory: string) => void;
    setHardwareAccelerationOptions: (options: string[]) => void;
    setHardwareAccelerationMode: (mode: string) => void;
    toggleAlwaysAskDownloadDirectory: () => void;
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
            hardwareAccelerationSupported: false,
            hardwareAccelerationOptions: [FALLBACK_HARDWARE_ACCELERATION_MODE],
            hardwareAccelerationMode: FALLBACK_HARDWARE_ACCELERATION_MODE,
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

            setHardwareAccelerationOptions: (options) => set((state) => {
                const normalizedOptions = normalizeHardwareAccelerationOptions(options);
                const hasHardwareOption = normalizedOptions.some((option) => option !== FALLBACK_HARDWARE_ACCELERATION_MODE);

                let nextMode = normalizeHardwareAccelerationMode(state.hardwareAccelerationMode);
                if (!normalizedOptions.includes(nextMode)) {
                    nextMode = hasHardwareOption ? normalizedOptions[1] : FALLBACK_HARDWARE_ACCELERATION_MODE;
                }

                return {
                    hardwareAccelerationOptions: normalizedOptions,
                    hardwareAccelerationSupported: hasHardwareOption,
                    hardwareAccelerationMode: nextMode,
                };
            }),

            setHardwareAccelerationMode: (mode) => set((state) => {
                const normalizedMode = normalizeHardwareAccelerationMode(mode);
                const selectedMode = state.hardwareAccelerationOptions.includes(normalizedMode)
                    ? normalizedMode
                    : FALLBACK_HARDWARE_ACCELERATION_MODE;

                return {
                    hardwareAccelerationMode: selectedMode,
                };
            }),

            toggleAutoCheckUpdates: () => set((state) => ({
                autoCheckUpdates: !state.autoCheckUpdates,
            })),
        }),
        {
            name: "cosmo-settings",
            storage: createJSONStorage(() => localStorage),
            version: 5,
            migrate: (persistedState) => {
                const previous = (persistedState as Partial<SettingsStore> | undefined) ?? {};
                const normalizedDefaultDownloadDirectory = normalizeDirectoryPath(previous.defaultDownloadDirectory);
                const isDefaultDownloadDirectoryUserSet =
                    typeof previous.isDefaultDownloadDirectoryUserSet === "boolean"
                        ? previous.isDefaultDownloadDirectoryUserSet
                        : normalizedDefaultDownloadDirectory.length > 0;
                const normalizedHardwareAccelerationMode = normalizeHardwareAccelerationMode(
                    previous.hardwareAccelerationMode,
                );

                return {
                    ...previous,
                    language: normalizeLanguage(previous.language),
                    browserForCookies: normalizeBrowser(previous.browserForCookies),
                    defaultDownloadDirectory: normalizedDefaultDownloadDirectory,
                    isDefaultDownloadDirectoryUserSet: isDefaultDownloadDirectoryUserSet,
                    hardwareAccelerationMode: normalizedHardwareAccelerationMode,
                };
            },
            partialize: (state) => ({
                language: state.language,
                browserForCookies: state.browserForCookies,
                alwaysAskDownloadDirectory: state.alwaysAskDownloadDirectory,
                defaultDownloadDirectory: state.defaultDownloadDirectory,
                isDefaultDownloadDirectoryUserSet: state.isDefaultDownloadDirectoryUserSet,
                hardwareAccelerationMode: state.hardwareAccelerationMode,
                autoCheckUpdates: state.autoCheckUpdates,
            }),
        },
    ),
)
