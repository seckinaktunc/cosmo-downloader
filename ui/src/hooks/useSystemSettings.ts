import { useEffect } from "react";
import { postWebViewMessage, subscribeWebViewMessages } from "@/lib/webview";
import { useSettingsStore } from "@/stores/settingsStore";

const HARDWARE_ACCELERATION_OPTIONS_PREFIX = "hardware_acceleration_options:";
const DEFAULT_DOWNLOAD_DIRECTORY_PREFIX = "default_download_directory:";
const SELECTED_DOWNLOAD_DIRECTORY_PREFIX = "default_download_directory_selected:";

function parseHardwareAccelerationOptions(value: string): string[] {
    const parsed = value
        .split(",")
        .map((option) => option.trim().toLowerCase())
        .filter((option) => option.length > 0);

    return Array.from(new Set(parsed));
}

export function useSystemSettings(): void {
    const setHardwareAccelerationOptions = useSettingsStore((state) => state.setHardwareAccelerationOptions);
    const applySystemDefaultDownloadDirectory = useSettingsStore((state) => state.applySystemDefaultDownloadDirectory);
    const setDefaultDownloadDirectoryByUser = useSettingsStore((state) => state.setDefaultDownloadDirectoryByUser);

    useEffect(() => {
        const unsubscribe = subscribeWebViewMessages((event) => {
            const message = event.data;

            if (message.startsWith(HARDWARE_ACCELERATION_OPTIONS_PREFIX)) {
                const options = parseHardwareAccelerationOptions(message.slice(HARDWARE_ACCELERATION_OPTIONS_PREFIX.length));
                setHardwareAccelerationOptions(options);
                return;
            }

            if (message.startsWith(DEFAULT_DOWNLOAD_DIRECTORY_PREFIX)) {
                const path = message.slice(DEFAULT_DOWNLOAD_DIRECTORY_PREFIX.length);
                applySystemDefaultDownloadDirectory(path);
                return;
            }

            if (message.startsWith(SELECTED_DOWNLOAD_DIRECTORY_PREFIX)) {
                const path = message.slice(SELECTED_DOWNLOAD_DIRECTORY_PREFIX.length);
                setDefaultDownloadDirectoryByUser(path);
            }
        });

        postWebViewMessage("request_hardware_acceleration_options");
        postWebViewMessage("request_default_download_directory");

        return unsubscribe;
    }, [
        applySystemDefaultDownloadDirectory,
        setDefaultDownloadDirectoryByUser,
        setHardwareAccelerationOptions,
    ]);
}
