export async function copyToClipboard(text: string): Promise<boolean> {
    if (!text) return false;

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }

        throw new Error("Clipboard API not supported");
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
            console.error("Kopyalama başarısız:", fallbackErr);
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

        console.warn("Clipboard okuma izni yok veya tarayıcı desteklemiyor.");
        return null;
    } catch (err) {
        console.error("Panodan okuma hatası:", err);
        return null;
    }
}