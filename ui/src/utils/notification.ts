export function sendNativeNotification(title: string, message: string) {
    if (window.chrome?.webview) {
        window.chrome.webview.postMessage(`notification:${title}|${message}`);
    } else {
        if (Notification.permission === "granted") {
            new Notification(title, { body: message });
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                    new Notification(title, { body: message });
                }
            });
        }
        console.log(`[Notification] ${title}: ${message}`);
    }
}