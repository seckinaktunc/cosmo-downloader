import { useEffect } from "react";
import { postWebViewMessage, subscribeWebViewMessages } from "@/lib/webview";
import { useSettingsStore } from "@/stores/settingsStore";

const HARDWARE_ACCELERATION_PREFIX = "hardware_acceleration_supported:";
const DEFAULT_DOWNLOAD_DIRECTORY_PREFIX = "default_download_directory:";
const SELECTED_DOWNLOAD_DIRECTORY_PREFIX = "default_download_directory_selected:";

function parseBoolean(value: string): boolean | null {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
        return true;
    }

    if (normalized === "false" || normalized === "0") {
        return false;
    }

    return null;
}

export function useSystemSettings(): void {
    const setHardwareAccelerationSupported = useSettingsStore((state) => state.setHardwareAccelerationSupported);
    const applySystemDefaultDownloadDirectory = useSettingsStore((state) => state.applySystemDefaultDownloadDirectory);
    const setDefaultDownloadDirectoryByUser = useSettingsStore((state) => state.setDefaultDownloadDirectoryByUser);

    useEffect(() => {
        const unsubscribe = subscribeWebViewMessages((event) => {
            const message = event.data;

            if (message.startsWith(HARDWARE_ACCELERATION_PREFIX)) {
                const supported = parseBoolean(message.slice(HARDWARE_ACCELERATION_PREFIX.length));
                if (supported != null) {
                    setHardwareAccelerationSupported(supported);
                }
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

        postWebViewMessage("request_hardware_acceleration_support");
        postWebViewMessage("request_default_download_directory");

        return unsubscribe;
    }, [
        applySystemDefaultDownloadDirectory,
        setDefaultDownloadDirectoryByUser,
        setHardwareAccelerationSupported,
    ]);
}
