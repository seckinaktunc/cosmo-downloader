#pragma once

#include <string>
#include <windows.h>
#include <WebView2.h>

void HandleWebMessage(
    HWND hWnd,
    const std::wstring& message,
    ICoreWebView2* webview,
    bool& hasCenteredOnFirstResize
);
