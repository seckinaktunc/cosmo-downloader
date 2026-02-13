#include "WebMessageHandler.h"

#include "Core/WindowManager.h"
#include "Utils/FolderDialog.h"
#include "Utils/NotificationService.h"
#include "Utils/YtDlpRunner.h"
#include <thread>
#include <wil/com.h>
#include <wil/resource.h>

namespace {
    struct DownloadRequest {
        std::wstring url;
        std::wstring format = L"mp4";
        int resolution = 1080;
        int bitrate = 192;
        int fps = 30;
    };

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
        request.url = payload;

        const size_t firstSeparator = payload.find(L"|");
        if (firstSeparator == std::wstring::npos) {
            return request;
        }

        request.url = payload.substr(0, firstSeparator);
        const std::wstring remainingAfterUrl = payload.substr(firstSeparator + 1);

        const size_t secondSeparator = remainingAfterUrl.find(L"|");
        if (secondSeparator == std::wstring::npos) {
            return request;
        }

        request.format = remainingAfterUrl.substr(0, secondSeparator);
        const std::wstring remainingAfterFormat = remainingAfterUrl.substr(secondSeparator + 1);

        const size_t thirdSeparator = remainingAfterFormat.find(L"|");
        if (thirdSeparator == std::wstring::npos) {
            return request;
        }

        try {
            request.resolution = std::stoi(remainingAfterFormat.substr(0, thirdSeparator));
            const std::wstring remainingAfterResolution = remainingAfterFormat.substr(thirdSeparator + 1);

            const size_t fourthSeparator = remainingAfterResolution.find(L"|");
            if (fourthSeparator != std::wstring::npos) {
                request.bitrate = std::stoi(remainingAfterResolution.substr(0, fourthSeparator));
                request.fps = std::stoi(remainingAfterResolution.substr(fourthSeparator + 1));
            }
            else {
                request.bitrate = std::stoi(remainingAfterResolution);
            }
        }
        catch (...) {
        }

        return request;
    }

    void HandleDownloadMessage(HWND hWnd, const std::wstring& message, ICoreWebView2* webview) {
        if (webview == nullptr) {
            return;
        }

        const DownloadRequest request = ParseDownloadPayload(message.substr(9));
        const std::wstring savePath = SelectFolder(hWnd);
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
                    webviewOnWorker.get()
                );
            }
            }).detach();
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
    }
}
