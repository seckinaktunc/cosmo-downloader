#pragma once

#include <string>
#include <WebView2.h>

void RunYtDlp(
    const std::wstring& url,
    const std::wstring& path,
    const std::wstring& format,
    int resolution,
    int bitrate,
    int fps,
    ICoreWebView2* webviewPtr
);
