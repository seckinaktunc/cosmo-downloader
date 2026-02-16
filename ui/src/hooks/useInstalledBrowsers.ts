import { useEffect } from "react";
import { isBrowserOptionValue, type BrowserOptionValue } from "@/constants/browserOptions";
import { postWebViewMessage, subscribeWebViewMessages } from "@/lib/webview";
import { useSettingsStore } from "@/stores/settingsStore";

const INSTALLED_BROWSERS_PREFIX = "installed_browsers:";

function parseInstalledBrowsersMessage(message: string): BrowserOptionValue[] | null {
    if (!message.startsWith(INSTALLED_BROWSERS_PREFIX)) {
        return null;
    }

    const payload = message.slice(INSTALLED_BROWSERS_PREFIX.length).trim();
    if (payload.length === 0) {
        return [];
    }

    const values = payload
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter((value): value is BrowserOptionValue => isBrowserOptionValue(value) && value !== "default");

    return Array.from(new Set(values));
}

export function useInstalledBrowsers(): void {
    const setInstalledBrowsers = useSettingsStore((state) => state.setInstalledBrowsers);

    useEffect(() => {
        const unsubscribe = subscribeWebViewMessages((event) => {
            const installedBrowsers = parseInstalledBrowsersMessage(event.data);
            if (installedBrowsers == null) {
                return;
            }

            setInstalledBrowsers(installedBrowsers);
        });

        postWebViewMessage("request_installed_browsers");

        return unsubscribe;
    }, [setInstalledBrowsers]);
}
