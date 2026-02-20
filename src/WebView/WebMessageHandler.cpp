#include "WebMessageHandler.h"

#include "Core/WindowManager.h"
#include "Utils/BrowserDetector.h"
#include "Utils/Clipboard.h"
#include "Utils/FFmpegRunner.h"
#include "Utils/FolderDialog.h"
#include "Utils/NotificationService.h"
#include "Utils/SystemSettings.h"
#include "Utils/YtDlpRunner.h"
#include <thread>
#include <vector>
#include <wil/com.h>
#include <wil/resource.h>

namespace {
    struct DownloadRequest {
        std::wstring url;
        std::wstring format = L"mp4";
        int resolution = 1080;
        int bitrate = 192;
        int fps = 30;
        std::wstring videoCodec = L"auto";
        std::wstring audioCodec = L"auto";
        bool alwaysAskDownloadDirectory = true;
        std::wstring defaultDownloadDirectory;
        std::wstring browserForCookies = L"default";
        std::wstring hardwareAccelerationMode = L"none";
    };

    struct MetadataRequest {
        std::wstring url;
        std::wstring browserForCookies = L"default";
    };

    struct ThumbnailRequest {
        std::wstring url;
        bool alwaysAskDownloadDirectory = true;
        std::wstring defaultDownloadDirectory;
        std::wstring browserForCookies = L"default";
    };

    std::vector<std::wstring> SplitByPipe(const std::wstring& value) {
        std::vector<std::wstring> parts;
        size_t start = 0;

        while (start <= value.size()) {
            const size_t separator = value.find(L'|', start);
            if (separator == std::wstring::npos) {
                parts.emplace_back(value.substr(start));
                break;
            }

            parts.emplace_back(value.substr(start, separator - start));
            start = separator + 1;
        }

        return parts;
    }

    void TryParseIntegerField(const std::vector<std::wstring>& fields, size_t index, int& target) {
        if (index >= fields.size()) {
            return;
        }

        try {
            target = std::stoi(fields[index]);
        }
        catch (...) {
        }
    }

    bool ParseBooleanField(const std::wstring& value, bool fallbackValue) {
        if (value == L"true" || value == L"1") {
            return true;
        }

        if (value == L"false" || value == L"0") {
            return false;
        }

        return fallbackValue;
    }

    std::wstring JoinWithComma(const std::vector<std::wstring>& values) {
        if (values.empty()) {
            return L"";
        }

        std::wstring joined;
        for (size_t index = 0; index < values.size(); ++index) {
            if (index > 0) {
                joined += L",";
            }
            joined += values[index];
        }

        return joined;
    }

    std::wstring JoinIntegersWithComma(const std::vector<int>& values) {
        if (values.empty()) {
            return L"";
        }

        std::wstring joined;
        for (size_t index = 0; index < values.size(); ++index) {
            if (index > 0) {
                joined += L",";
            }

            joined += std::to_wstring(values[index]);
        }

        return joined;
    }

    void PostWebMessage(ICoreWebView2* webview, const std::wstring& message) {
        if (webview == nullptr) {
            return;
        }

        webview->PostWebMessageAsString(message.c_str());
    }

    bool ParseResizePayload(const std::wstring& payload, int& width, int& height) {
        const size_t commaPosition = payload.find(L",");
        if (commaPosition == std::wstring::npos) {
            return false;
        }

        try {
            width = std::stoi(payload.substr(0, commaPosition));
            height = std::stoi(payload.substr(commaPosition + 1));
        }
        catch (...) {
            return false;
        }

        return width > 0 && height > 0;
    }

    void HandleResizeMessage(HWND hWnd, const std::wstring& message, bool& hasCenteredOnFirstResize) {
        int width = 0;
        int height = 0;

        if (!ParseResizePayload(message.substr(7), width, height)) {
            return;
        }

        if (!hasCenteredOnFirstResize) {
            ResizeAndCenterWindow(hWnd, width, height);
            hasCenteredOnFirstResize = true;
            return;
        }

        SetWindowPos(
            hWnd,
            nullptr,
            0,
            0,
            width,
            height,
            SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE
        );
    }

    void HandleNotificationMessage(HWND hWnd, const std::wstring& message) {
        const std::wstring payload = message.substr(13);
        const size_t separator = payload.find(L"|");
        if (separator == std::wstring::npos) {
            return;
        }

        const std::wstring title = payload.substr(0, separator);
        const std::wstring body = payload.substr(separator + 1);
        SendNativeNotification(hWnd, title, body);
    }

    DownloadRequest ParseDownloadPayload(const std::wstring& payload) {
        DownloadRequest request;
        const std::vector<std::wstring> fields = SplitByPipe(payload);
        if (fields.empty()) {
            return request;
        }

        request.url = fields[0];

        if (fields.size() > 1 && !fields[1].empty()) {
            request.format = fields[1];
        }

        TryParseIntegerField(fields, 2, request.resolution);
        TryParseIntegerField(fields, 3, request.bitrate);
        TryParseIntegerField(fields, 4, request.fps);

        if (fields.size() > 5 && !fields[5].empty()) {
            request.videoCodec = fields[5];
        }

        if (fields.size() > 6 && !fields[6].empty()) {
            request.audioCodec = fields[6];
        }

        if (fields.size() > 7) {
            request.alwaysAskDownloadDirectory = ParseBooleanField(fields[7], true);
        }

        if (fields.size() > 8) {
            request.defaultDownloadDirectory = fields[8];
        }

        if (fields.size() > 9 && !fields[9].empty()) {
            request.browserForCookies = fields[9];
        }

        if (fields.size() > 10) {
            const std::wstring rawMode = fields[10];
            if (!rawMode.empty()) {
                request.hardwareAccelerationMode = rawMode;
            }
        }

        return request;
    }

    MetadataRequest ParseMetadataPayload(const std::wstring& payload) {
        MetadataRequest request;
        const std::vector<std::wstring> fields = SplitByPipe(payload);
        if (fields.empty()) {
            return request;
        }

        request.url = fields[0];

        if (fields.size() > 1 && !fields[1].empty()) {
            request.browserForCookies = fields[1];
        }

        return request;
    }

    ThumbnailRequest ParseThumbnailPayload(const std::wstring& payload) {
        ThumbnailRequest request;
        const std::vector<std::wstring> fields = SplitByPipe(payload);
        if (fields.empty()) {
            return request;
        }

        request.url = fields[0];

        if (fields.size() > 1) {
            request.alwaysAskDownloadDirectory = ParseBooleanField(fields[1], true);
        }

        if (fields.size() > 2) {
            request.defaultDownloadDirectory = fields[2];
        }

        if (fields.size() > 3 && !fields[3].empty()) {
            request.browserForCookies = fields[3];
        }

        return request;
    }

    std::wstring ResolveSavePath(HWND hWnd, bool alwaysAskDownloadDirectory, const std::wstring& defaultDownloadDirectory) {
        if (alwaysAskDownloadDirectory) {
            return SelectFolder(hWnd);
        }

        std::wstring savePath = defaultDownloadDirectory;
        if (savePath.empty()) {
            savePath = GetDefaultDownloadDirectory();
        }

        if (savePath.empty()) {
            savePath = SelectFolder(hWnd);
        }

        return savePath;
    }

    void HandleDownloadMessage(HWND hWnd, const std::wstring& message, ICoreWebView2* webview) {
        if (webview == nullptr) {
            return;
        }

        const DownloadRequest request = ParseDownloadPayload(message.substr(9));
        std::wstring savePath = ResolveSavePath(
            hWnd,
            request.alwaysAskDownloadDirectory,
            request.defaultDownloadDirectory
        );

        if (savePath.empty()) {
            return;
        }

        IStream* marshaledWebView = nullptr;
        if (!SUCCEEDED(CoMarshalInterThreadInterfaceInStream(IID_ICoreWebView2, webview, &marshaledWebView))) {
            return;
        }

        std::thread([request, savePath, marshaledWebView]() {
            const HRESULT coInitializeResult = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
            const bool shouldCoUninitialize = SUCCEEDED(coInitializeResult) || coInitializeResult == RPC_E_CHANGED_MODE;
            const auto coUninitializeScope = wil::scope_exit([shouldCoUninitialize]() {
                if (shouldCoUninitialize) {
                    CoUninitialize();
                }
                });

            wil::com_ptr<ICoreWebView2> webviewOnWorker;
            if (SUCCEEDED(CoGetInterfaceAndReleaseStream(
                marshaledWebView, IID_ICoreWebView2, reinterpret_cast<void**>(webviewOnWorker.put())))) {
                RunYtDlp(
                    request.url,
                    savePath,
                    request.format,
                    request.resolution,
                    request.bitrate,
                    request.fps,
                    request.videoCodec,
                    request.audioCodec,
                    request.browserForCookies,
                    request.hardwareAccelerationMode,
                    webviewOnWorker.get()
                );
            }
            }).detach();
    }

    void HandleFetchMetadataMessage(const std::wstring& message, ICoreWebView2* webview) {
        if (webview == nullptr) {
            return;
        }

        const MetadataRequest request = ParseMetadataPayload(message.substr(15));
        if (request.url.empty()) {
            return;
        }

        IStream* marshaledWebView = nullptr;
        if (!SUCCEEDED(CoMarshalInterThreadInterfaceInStream(IID_ICoreWebView2, webview, &marshaledWebView))) {
            return;
        }

        std::thread([request, marshaledWebView]() {
            const HRESULT coInitializeResult = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
            const bool shouldCoUninitialize = SUCCEEDED(coInitializeResult) || coInitializeResult == RPC_E_CHANGED_MODE;
            const auto coUninitializeScope = wil::scope_exit([shouldCoUninitialize]() {
                if (shouldCoUninitialize) {
                    CoUninitialize();
                }
                });

            wil::com_ptr<ICoreWebView2> webviewOnWorker;
            if (!SUCCEEDED(CoGetInterfaceAndReleaseStream(
                marshaledWebView, IID_ICoreWebView2, reinterpret_cast<void**>(webviewOnWorker.put())))) {
                return;
            }

            YtDlpMetadata metadata;
            if (FetchYtDlpMetadata(request.url, request.browserForCookies, metadata)) {
                PostWebMessage(
                    webviewOnWorker.get(),
                    L"metadata:success:" +
                    request.url +
                    L"|" + JoinIntegersWithComma(metadata.availableResolutions) +
                    L"|" + JoinIntegersWithComma(metadata.availableFps) +
                    L"|" + JoinIntegersWithComma(metadata.availableAudioBitrates) +
                    L"|" + metadata.thumbnailUrl
                );
                return;
            }

            PostWebMessage(webviewOnWorker.get(), L"metadata:error:" + request.url);
            }).detach();
    }

    void HandleDownloadThumbnailMessage(HWND hWnd, const std::wstring& message, ICoreWebView2* webview) {
        if (webview == nullptr) {
            return;
        }

        const ThumbnailRequest request = ParseThumbnailPayload(message.substr(19));
        if (request.url.empty()) {
            return;
        }

        const std::wstring savePath = ResolveSavePath(
            hWnd,
            request.alwaysAskDownloadDirectory,
            request.defaultDownloadDirectory
        );
        if (savePath.empty()) {
            return;
        }

        IStream* marshaledWebView = nullptr;
        if (!SUCCEEDED(CoMarshalInterThreadInterfaceInStream(IID_ICoreWebView2, webview, &marshaledWebView))) {
            return;
        }

        std::thread([request, savePath, marshaledWebView]() {
            const HRESULT coInitializeResult = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
            const bool shouldCoUninitialize = SUCCEEDED(coInitializeResult) || coInitializeResult == RPC_E_CHANGED_MODE;
            const auto coUninitializeScope = wil::scope_exit([shouldCoUninitialize]() {
                if (shouldCoUninitialize) {
                    CoUninitialize();
                }
                });

            wil::com_ptr<ICoreWebView2> webviewOnWorker;
            if (SUCCEEDED(CoGetInterfaceAndReleaseStream(
                marshaledWebView, IID_ICoreWebView2, reinterpret_cast<void**>(webviewOnWorker.put())))) {
                RunYtDlpThumbnailDownload(
                    request.url,
                    savePath,
                    request.browserForCookies,
                    webviewOnWorker.get()
                );
            }
            }).detach();
    }

    void HandleInstalledBrowsersRequest(ICoreWebView2* webview) {
        const std::vector<std::wstring> installedBrowsers = DetectInstalledBrowsers();
        const std::wstring payload = JoinWithComma(installedBrowsers);
        PostWebMessage(webview, L"installed_browsers:" + payload);
    }

    void HandleHardwareAccelerationOptionsRequest(ICoreWebView2* webview) {
        std::vector<std::wstring> options = { L"none" };
        const std::vector<std::wstring> ffmpegOptions = GetAvailableFFmpegHardwareAccelerationOptions();
        options.insert(options.end(), ffmpegOptions.begin(), ffmpegOptions.end());
        PostWebMessage(webview, L"hardware_acceleration_options:" + JoinWithComma(options));
    }

    void HandleDefaultDownloadDirectoryRequest(ICoreWebView2* webview) {
        const std::wstring path = GetDefaultDownloadDirectory();
        PostWebMessage(webview, L"default_download_directory:" + path);
    }

    void HandleSelectDefaultDownloadDirectoryMessage(HWND hWnd, ICoreWebView2* webview) {
        const std::wstring selectedPath = SelectFolder(hWnd);
        if (selectedPath.empty()) {
            return;
        }

        PostWebMessage(webview, L"default_download_directory_selected:" + selectedPath);
    }

    void HandleClipboardTextRequest(ICoreWebView2* webview) {
        PostWebMessage(webview, L"clipboard_updated:" + GetClipboardText());
    }
}

void HandleWebMessage(
    HWND hWnd,
    const std::wstring& message,
    ICoreWebView2* webview,
    bool& hasCenteredOnFirstResize
) {
    if (message == L"start_drag") {
        ReleaseCapture();
        PostMessage(hWnd, WM_NCLBUTTONDOWN, HTCAPTION, 0);
        return;
    }

    if (message == L"close_window") {
        PostQuitMessage(0);
        return;
    }

    if (message == L"minimize_window") {
        ShowWindow(hWnd, SW_MINIMIZE);
        return;
    }

    if (message == L"show_window") {
        ShowWindow(hWnd, SW_SHOW);
        UpdateWindow(hWnd);
        SetForegroundWindow(hWnd);
        return;
    }

    if (message.rfind(L"set_pinned:", 0) == 0) {
        const std::wstring value = message.substr(11);
        const bool isPinned = (value == L"true");
        SetWindowPos(
            hWnd,
            isPinned ? HWND_TOPMOST : HWND_NOTOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
        );
        return;
    }

    if (message.rfind(L"resize:", 0) == 0) {
        HandleResizeMessage(hWnd, message, hasCenteredOnFirstResize);
        return;
    }

    if (message.rfind(L"notification:", 0) == 0) {
        HandleNotificationMessage(hWnd, message);
        return;
    }

    if (message.rfind(L"download:", 0) == 0) {
        HandleDownloadMessage(hWnd, message, webview);
        return;
    }

    if (message == L"cancel_download") {
        CancelActiveYtDlpDownload();
        return;
    }

    if (message.rfind(L"fetch_metadata:", 0) == 0) {
        HandleFetchMetadataMessage(message, webview);
        return;
    }

    if (message.rfind(L"download_thumbnail:", 0) == 0) {
        HandleDownloadThumbnailMessage(hWnd, message, webview);
        return;
    }

    if (message == L"request_installed_browsers") {
        HandleInstalledBrowsersRequest(webview);
        return;
    }

    if (message == L"request_hardware_acceleration_options") {
        HandleHardwareAccelerationOptionsRequest(webview);
        return;
    }

    if (message == L"request_default_download_directory") {
        HandleDefaultDownloadDirectoryRequest(webview);
        return;
    }

    if (message == L"select_default_download_directory") {
        HandleSelectDefaultDownloadDirectoryMessage(hWnd, webview);
        return;
    }

    if (message == L"open_download_logs") {
        OpenDownloadLogInDefaultEditor();
        return;
    }

    if (message == L"request_clipboard_text") {
        HandleClipboardTextRequest(webview);
    }
}
