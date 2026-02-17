#include "Clipboard.h"

#include <windows.h>
#include <wil/resource.h>

std::wstring GetClipboardText() {
    if (!OpenClipboard(nullptr)) {
        return L"";
    }

    const auto closeClipboard = wil::scope_exit([]() {
        CloseClipboard();
    });

    HANDLE handle = GetClipboardData(CF_UNICODETEXT);
    if (handle == nullptr) {
        return L"";
    }

    const wchar_t* text = static_cast<const wchar_t*>(GlobalLock(handle));
    if (text == nullptr) {
        return L"";
    }

    std::wstring result(text);
    GlobalUnlock(handle);
    return result;
}
