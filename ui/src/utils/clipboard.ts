import { getLocaleMessages } from "@/locale";
import { useSettingsStore } from "@/stores/settingsStore";

function getClipboardLocale() {
    const language = useSettingsStore.getState().language;
    return getLocaleMessages(language).clipboard;
}

export async function copyToClipboard(text: string): Promise<boolean> {
    if (!text) return false;

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }

        throw new Error();
    } catch (err) {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;

            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);

            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);

            return successful;
        } catch (fallbackErr) {
            const clipboardLocale = getClipboardLocale();
            console.error(`${clipboardLocale.copyFailed}:`, fallbackErr);
            return false;
        }
    }
}

export async function readFromClipboard(): Promise<string | null> {
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            return text;
        }

        const clipboardLocale = getClipboardLocale();
        console.warn(clipboardLocale.readUnavailable);
        return null;
    } catch (err) {
        const clipboardLocale = getClipboardLocale();
        console.error(`${clipboardLocale.readError}:`, err);
        return null;
    }
}
