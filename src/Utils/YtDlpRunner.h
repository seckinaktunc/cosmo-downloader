#pragma once

#include <string>
#include <vector>
#include <WebView2.h>

struct YtDlpMetadata {
    std::vector<int> availableResolutions;
    std::vector<int> availableFps;
    std::vector<int> availableAudioBitrates;
    std::wstring thumbnailUrl;
};

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
    const std::wstring& hardwareAccelerationMode,
    ICoreWebView2* webviewPtr
);

bool FetchYtDlpMetadata(
    const std::wstring& url,
    const std::wstring& browserForCookies,
    YtDlpMetadata& metadata
);

void CancelActiveYtDlpDownload();

void RunYtDlpThumbnailDownload(
    const std::wstring& url,
    const std::wstring& path,
    const std::wstring& browserForCookies,
    ICoreWebView2* webviewPtr
);

std::wstring GetDownloadLogFilePath();
bool OpenDownloadLogInDefaultEditor();
