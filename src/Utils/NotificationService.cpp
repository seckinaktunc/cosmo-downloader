#include "NotificationService.h"

#include <shellapi.h>

void SendNativeNotification(HWND hWnd, const std::wstring& title, const std::wstring& message) {
    NOTIFYICONDATA nid = {};
    nid.cbSize = sizeof(NOTIFYICONDATA);
    nid.hWnd = hWnd;
    nid.uID = 1001;
    nid.uFlags = NIF_ICON | NIF_INFO | NIF_TIP;
    nid.hIcon = LoadIcon(nullptr, IDI_APPLICATION);

    wcsncpy_s(nid.szTip, title.c_str(), _TRUNCATE);
    wcsncpy_s(nid.szInfoTitle, title.c_str(), _TRUNCATE);
    wcsncpy_s(nid.szInfo, message.c_str(), _TRUNCATE);

    nid.dwInfoFlags = NIIF_INFO;
    nid.uTimeout = 10000;

    if (!Shell_NotifyIcon(NIM_ADD, &nid)) {
        Shell_NotifyIcon(NIM_MODIFY, &nid);
    }
}
