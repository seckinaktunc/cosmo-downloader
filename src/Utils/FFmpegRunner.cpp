#include "FFmpegRunner.h"

#include "ExecutableResolver.h"

#include <algorithm>
#include <array>
#include <cctype>
#include <cwctype>
#include <vector>
#include <windows.h>

namespace {
    bool IsAudioOnlyFormat(const std::wstring& format) {
        return format == L"mp3" || format == L"wav";
    }

    std::wstring ToLower(std::wstring value) {
        std::transform(
            value.begin(),
            value.end(),
            value.begin(),
            [](wchar_t ch) {
                return static_cast<wchar_t>(towlower(ch));
            }
        );
        return value;
    }

    std::wstring Quote(const std::wstring& value) {
        return L"\"" + value + L"\"";
    }

    std::wstring MapVideoCodec(const std::wstring& codec) {
        if (codec == L"av01") {
            return L"libaom-av1";
        }
        if (codec == L"vp9") {
            return L"libvpx-vp9";
        }
        if (codec == L"h265") {
            return L"libx265";
        }
        if (codec == L"h264") {
            return L"libx264";
        }
        return L"";
    }

    std::wstring MapAudioCodec(const std::wstring& codec) {
        if (codec == L"opus") {
            return L"libopus";
        }
        if (codec == L"vorbis") {
            return L"libvorbis";
        }
        if (codec == L"aac" || codec == L"mp4a") {
            return L"aac";
        }
        if (codec == L"mp3") {
            return L"libmp3lame";
        }
        return L"";
    }

    bool ExecuteCommand(
        const std::wstring& commandLine,
        std::vector<std::wstring>* outputLines,
        DWORD& exitCode
    ) {
        std::vector<wchar_t> commandBuffer(commandLine.begin(), commandLine.end());
        commandBuffer.push_back(L'\0');

        SECURITY_ATTRIBUTES securityAttributes = {};
        securityAttributes.nLength = sizeof(SECURITY_ATTRIBUTES);
        securityAttributes.bInheritHandle = TRUE;

        HANDLE readPipe = nullptr;
        HANDLE writePipe = nullptr;
        if (!CreatePipe(&readPipe, &writePipe, &securityAttributes, 0)) {
            return false;
        }

        if (!SetHandleInformation(readPipe, HANDLE_FLAG_INHERIT, 0)) {
            CloseHandle(readPipe);
            CloseHandle(writePipe);
            return false;
        }

        STARTUPINFO startupInfo = {};
        startupInfo.cb = sizeof(STARTUPINFO);
        startupInfo.dwFlags = STARTF_USESTDHANDLES;
        startupInfo.hStdOutput = writePipe;
        startupInfo.hStdError = writePipe;
        startupInfo.hStdInput = GetStdHandle(STD_INPUT_HANDLE);

        PROCESS_INFORMATION processInfo = {};
        const BOOL created = CreateProcessW(
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

        if (!created) {
            CloseHandle(readPipe);
            return false;
        }

        std::string pendingLine;
        std::array<char, 4096> buffer = {};
        DWORD bytesRead = 0;

        while (ReadFile(readPipe, buffer.data(), static_cast<DWORD>(buffer.size()), &bytesRead, nullptr) && bytesRead > 0) {
            pendingLine.append(buffer.data(), buffer.data() + bytesRead);

            size_t newline = pendingLine.find('\n');
            while (newline != std::string::npos) {
                std::string line = pendingLine.substr(0, newline);
                if (!line.empty() && line.back() == '\r') {
                    line.pop_back();
                }

                if (outputLines != nullptr) {
                    const int wideCount = MultiByteToWideChar(
                        CP_UTF8,
                        0,
                        line.data(),
                        static_cast<int>(line.size()),
                        nullptr,
                        0
                    );
                    if (wideCount > 0) {
                        std::wstring wideLine(static_cast<size_t>(wideCount), L'\0');
                        MultiByteToWideChar(
                            CP_UTF8,
                            0,
                            line.data(),
                            static_cast<int>(line.size()),
                            wideLine.data(),
                            wideCount
                        );
                        outputLines->push_back(wideLine);
                    }
                }

                pendingLine.erase(0, newline + 1);
                newline = pendingLine.find('\n');
            }
        }

        if (!pendingLine.empty() && outputLines != nullptr) {
            const int wideCount = MultiByteToWideChar(
                CP_UTF8,
                0,
                pendingLine.data(),
                static_cast<int>(pendingLine.size()),
                nullptr,
                0
            );
            if (wideCount > 0) {
                std::wstring wideLine(static_cast<size_t>(wideCount), L'\0');
                MultiByteToWideChar(
                    CP_UTF8,
                    0,
                    pendingLine.data(),
                    static_cast<int>(pendingLine.size()),
                    wideLine.data(),
                    wideCount
                );
                outputLines->push_back(wideLine);
            }
        }

        CloseHandle(readPipe);

        WaitForSingleObject(processInfo.hProcess, INFINITE);
        GetExitCodeProcess(processInfo.hProcess, &exitCode);
        CloseHandle(processInfo.hThread);
        CloseHandle(processInfo.hProcess);
        return true;
    }

    std::wstring BuildConversionCommand(const std::wstring& ffmpegPath, const FFmpegConversionRequest& request) {
        std::wstring command = Quote(ffmpegPath) + L" -y";

        const std::wstring hwMode = NormalizeHardwareAccelerationMode(request.hardwareAccelerationMode);
        if (!hwMode.empty() && hwMode != L"none") {
            command += L" -hwaccel " + hwMode;
        }

        command += L" -i " + Quote(request.inputPath);

        const bool isAudioOnlyOutput = IsAudioOnlyFormat(ToLower(request.targetFormat));
        if (isAudioOnlyOutput) {
            command += L" -vn";
        }

        const std::wstring normalizedVideoCodec = ToLower(request.videoCodec);
        const std::wstring mappedVideoCodec = MapVideoCodec(normalizedVideoCodec);
        if (!isAudioOnlyOutput && !mappedVideoCodec.empty()) {
            command += L" -c:v " + mappedVideoCodec;
        }

        const std::wstring normalizedAudioCodec = ToLower(request.audioCodec);
        std::wstring mappedAudioCodec = MapAudioCodec(normalizedAudioCodec);
        if (mappedAudioCodec.empty() && isAudioOnlyOutput) {
            if (request.targetFormat == L"mp3") {
                mappedAudioCodec = L"libmp3lame";
            }
            else if (request.targetFormat == L"wav") {
                mappedAudioCodec = L"pcm_s16le";
            }
        }

        if (!mappedAudioCodec.empty()) {
            command += L" -c:a " + mappedAudioCodec;
        }

        if (request.audioBitrateKbps > 0) {
            command += L" -b:a " + std::to_wstring(request.audioBitrateKbps) + L"k";
        }

        command += L" " + Quote(request.outputPath);
        return command;
    }

    std::vector<std::wstring> ParseHardwareAccelerationOutput(const std::vector<std::wstring>& outputLines) {
        std::vector<std::wstring> options;
        for (const auto& line : outputLines) {
            std::wstring trimmed = line;
            trimmed.erase(trimmed.begin(), std::find_if(trimmed.begin(), trimmed.end(), [](wchar_t ch) {
                return !iswspace(ch);
                }));
            trimmed.erase(std::find_if(trimmed.rbegin(), trimmed.rend(), [](wchar_t ch) {
                return !iswspace(ch);
                }).base(), trimmed.end());

            if (trimmed.empty() || trimmed.find(L' ') != std::wstring::npos || trimmed.find(L':') != std::wstring::npos) {
                continue;
            }

            options.push_back(ToLower(trimmed));
        }

        std::sort(options.begin(), options.end());
        options.erase(std::unique(options.begin(), options.end()), options.end());
        return options;
    }
}

std::wstring ResolveFFmpegExecutable() {
    return ResolveBundledOrSystemExecutable(L"ffmpeg.exe");
}

std::wstring ResolveFFprobeExecutable() {
    return ResolveBundledOrSystemExecutable(L"ffprobe.exe");
}

std::vector<std::wstring> GetAvailableFFmpegHardwareAccelerationOptions() {
    const std::wstring ffmpegPath = ResolveFFmpegExecutable();
    if (ffmpegPath.empty()) {
        return {};
    }

    const std::wstring command = Quote(ffmpegPath) + L" -hide_banner -loglevel error -hwaccels";
    std::vector<std::wstring> outputLines;
    DWORD exitCode = 1;
    if (!ExecuteCommand(command, &outputLines, exitCode) || exitCode != 0) {
        return {};
    }

    return ParseHardwareAccelerationOutput(outputLines);
}

std::wstring NormalizeHardwareAccelerationMode(const std::wstring& requestedMode) {
    if (requestedMode.empty()) {
        return L"none";
    }

    const std::wstring normalizedRequestedMode = ToLower(requestedMode);
    if (normalizedRequestedMode == L"none") {
        return L"none";
    }

    if (normalizedRequestedMode == L"auto") {
        return L"auto";
    }

    const std::vector<std::wstring> options = GetAvailableFFmpegHardwareAccelerationOptions();
    if (std::find(options.begin(), options.end(), normalizedRequestedMode) != options.end()) {
        return normalizedRequestedMode;
    }

    return L"none";
}

bool ConvertMediaWithFFmpeg(
    const FFmpegConversionRequest& request,
    std::wstring& errorMessage
) {
    errorMessage.clear();

    const std::wstring ffmpegPath = ResolveFFmpegExecutable();
    if (ffmpegPath.empty()) {
        errorMessage = L"ffmpeg executable not found.";
        return false;
    }

    if (request.inputPath.empty() || request.outputPath.empty()) {
        errorMessage = L"Conversion paths are empty.";
        return false;
    }

    const std::wstring command = BuildConversionCommand(ffmpegPath, request);
    DWORD exitCode = 1;
    if (!ExecuteCommand(command, nullptr, exitCode)) {
        errorMessage = L"Failed to execute ffmpeg process.";
        return false;
    }

    if (exitCode != 0) {
        errorMessage = L"ffmpeg exited with code " + std::to_wstring(exitCode) + L".";
        return false;
    }

    return true;
}
