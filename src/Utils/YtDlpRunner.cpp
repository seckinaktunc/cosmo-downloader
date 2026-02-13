#include "YtDlpRunner.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <string>
#include <vector>
#include <wil/resource.h>
#include <windows.h>

namespace {
    void PostStatus(ICoreWebView2* webviewPtr, const wchar_t* statusMessage) {
        if (webviewPtr != nullptr) {
            webviewPtr->PostWebMessageAsString(statusMessage);
        }
    }

    void PostProgress(ICoreWebView2* webviewPtr, int progress) {
        if (webviewPtr == nullptr) {
            return;
        }

        const int safeProgress = std::clamp(progress, 0, 100);
        const std::wstring message = L"status:progress:" + std::to_wstring(safeProgress);
        webviewPtr->PostWebMessageAsString(message.c_str());
    }

    std::wstring BuildYtDlpCommand(
        const std::wstring& ytDlpPath,
        const std::wstring& url,
        const std::wstring& outputPath,
        const std::wstring& format,
        int resolution,
        int bitrate,
        int fps
    ) {
        std::wstring command = L"\"" + ytDlpPath + L"\" --newline --progress";

        const bool isAudio = (format == L"mp3" || format == L"wav");
        if (isAudio) {
            command += L" -x --audio-format " + format;
            if (bitrate > 0) {
                command += L" --audio-quality " + std::to_wstring(bitrate) + L"K";
            }
        }
        else {
            const std::wstring resolutionText = std::to_wstring(resolution);
            const std::wstring fpsText = std::to_wstring(fps);
            command += L" -f \"bestvideo[height<=" + resolutionText + L"][fps<=" + fpsText + L"]+bestaudio/best[height<=" + resolutionText + L"]\"";
            command += L" --merge-output-format " + format;
        }

        command += L" -o \"" + outputPath + L"\" \"" + url + L"\"";
        return command;
    }

    int ParseProgressPercent(const std::string& line) {
        int parsedProgress = -1;
        size_t percentPosition = line.find('%');

        while (percentPosition != std::string::npos) {
            size_t start = percentPosition;
            while (start > 0) {
                const unsigned char ch = static_cast<unsigned char>(line[start - 1]);
                if (!std::isdigit(ch) && line[start - 1] != '.') {
                    break;
                }
                --start;
            }

            if (start < percentPosition) {
                try {
                    const double value = std::stod(line.substr(start, percentPosition - start));
                    parsedProgress = std::clamp(static_cast<int>(std::lround(value)), 0, 100);
                }
                catch (...) {
                }
            }

            percentPosition = line.find('%', percentPosition + 1);
        }

        return parsedProgress;
    }

    std::wstring GetExecutableDirectory() {
        wchar_t modulePath[MAX_PATH] = {};
        const DWORD length = GetModuleFileNameW(nullptr, modulePath, static_cast<DWORD>(_countof(modulePath)));
        if (length == 0 || length == _countof(modulePath)) {
            return L"";
        }

        std::wstring path(modulePath, length);
        const size_t lastSlash = path.find_last_of(L"\\/");
        if (lastSlash != std::wstring::npos) {
            path.erase(lastSlash);
        }

        return path;
    }

    std::wstring ResolveYtDlpExecutable() {
        const std::wstring executableDirectory = GetExecutableDirectory();
        if (!executableDirectory.empty()) {
            const std::wstring localCopy = executableDirectory + L"\\yt-dlp.exe";
            if (GetFileAttributesW(localCopy.c_str()) != INVALID_FILE_ATTRIBUTES) {
                return localCopy;
            }
        }

        wchar_t foundPath[MAX_PATH] = {};
        if (SearchPathW(nullptr, L"yt-dlp.exe", nullptr, static_cast<DWORD>(_countof(foundPath)), foundPath, nullptr) > 0) {
            return std::wstring(foundPath);
        }

        return L"";
    }
}

void RunYtDlp(
    const std::wstring& url,
    const std::wstring& path,
    const std::wstring& format,
    int resolution,
    int bitrate,
    int fps,
    ICoreWebView2* webviewPtr
) {
    const HRESULT coInitializeResult = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    const bool shouldCoUninitialize = SUCCEEDED(coInitializeResult) || coInitializeResult == RPC_E_CHANGED_MODE;
    const auto coUninitializeScope = wil::scope_exit([shouldCoUninitialize]() {
        if (shouldCoUninitialize) {
            CoUninitialize();
        }
    });

    PostStatus(webviewPtr, L"status:downloading");
    PostProgress(webviewPtr, 0);

    const std::wstring ytDlpPath = ResolveYtDlpExecutable();
    if (ytDlpPath.empty()) {
        PostStatus(webviewPtr, L"status:error");
        return;
    }

    const std::wstring outputPath = path + L"\\%(title)s.%(ext)s";
    const std::wstring commandLine = BuildYtDlpCommand(ytDlpPath, url, outputPath, format, resolution, bitrate, fps);

    std::vector<wchar_t> commandBuffer(commandLine.begin(), commandLine.end());
    commandBuffer.push_back(L'\0');

    SECURITY_ATTRIBUTES securityAttributes = {};
    securityAttributes.nLength = sizeof(SECURITY_ATTRIBUTES);
    securityAttributes.bInheritHandle = TRUE;

    HANDLE readPipe = nullptr;
    HANDLE writePipe = nullptr;

    if (!CreatePipe(&readPipe, &writePipe, &securityAttributes, 0)) {
        PostStatus(webviewPtr, L"status:error");
        return;
    }

    SetHandleInformation(readPipe, HANDLE_FLAG_INHERIT, 0);

    STARTUPINFO startupInfo = {};
    startupInfo.cb = sizeof(STARTUPINFO);
    startupInfo.dwFlags = STARTF_USESTDHANDLES;
    startupInfo.hStdOutput = writePipe;
    startupInfo.hStdError = writePipe;
    startupInfo.hStdInput = GetStdHandle(STD_INPUT_HANDLE);

    PROCESS_INFORMATION processInfo = {};
    const BOOL processCreated = CreateProcessW(
        nullptr,
        commandBuffer.data(),
        nullptr,
        nullptr,
        TRUE,
        CREATE_NO_WINDOW,
        nullptr,
        nullptr,
        &startupInfo,
        &processInfo
    );

    CloseHandle(writePipe);

    if (!processCreated) {
        CloseHandle(readPipe);
        PostStatus(webviewPtr, L"status:error");
        return;
    }

    int lastProgress = 0;
    std::string pendingLine;
    char buffer[4096] = {};
    DWORD bytesRead = 0;

    while (ReadFile(readPipe, buffer, sizeof(buffer), &bytesRead, nullptr) && bytesRead > 0) {
        pendingLine.append(buffer, buffer + bytesRead);

        size_t newlinePosition = pendingLine.find('\n');
        while (newlinePosition != std::string::npos) {
            std::string line = pendingLine.substr(0, newlinePosition);
            if (!line.empty() && line.back() == '\r') {
                line.pop_back();
            }

            const int progress = ParseProgressPercent(line);
            if (progress >= 0 && progress != lastProgress) {
                lastProgress = progress;
                PostProgress(webviewPtr, lastProgress);
            }

            pendingLine.erase(0, newlinePosition + 1);
            newlinePosition = pendingLine.find('\n');
        }
    }

    if (!pendingLine.empty()) {
        const int progress = ParseProgressPercent(pendingLine);
        if (progress >= 0 && progress != lastProgress) {
            lastProgress = progress;
            PostProgress(webviewPtr, lastProgress);
        }
    }

    CloseHandle(readPipe);

    WaitForSingleObject(processInfo.hProcess, INFINITE);

    DWORD exitCode = 1;
    GetExitCodeProcess(processInfo.hProcess, &exitCode);

    CloseHandle(processInfo.hProcess);
    CloseHandle(processInfo.hThread);

    if (exitCode == 0) {
        if (lastProgress < 100) {
            PostProgress(webviewPtr, 100);
        }
        PostStatus(webviewPtr, L"status:done");
    }
    else {
        PostStatus(webviewPtr, L"status:error");
    }
}
