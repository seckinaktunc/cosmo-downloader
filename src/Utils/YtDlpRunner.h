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
    const std::wstring& videoCodec,
    const std::wstring& audioCodec,
    const std::wstring& browserForCookies,
    bool isHardwareAccelerationEnabled,
    ICoreWebView2* webviewPtr
);
