#pragma once
#include <windows.h>
#include <wrl.h>
#include <wil/com.h>
#include "WebView2.h"
#include <string>

class WebViewManager {
public:
    static WebViewManager& GetInstance();
    void Initialize(HWND hWnd);
    void Resize(HWND hWnd);
    void PostMessageToWeb(const std::wstring& message);
    ICoreWebView2* GetWebView();

private:
    wil::com_ptr<ICoreWebView2Controller> webviewController;
    wil::com_ptr<ICoreWebView2> webview;
    bool hasCenteredOnFirstResize = false;
};
