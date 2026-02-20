#include "YtDlpRunner.h"
#include "ExecutableResolver.h"
#include "FFmpegRunner.h"

#include <algorithm>
#include <array>
#include <cctype>
#include <chrono>
#include <cmath>
#include <filesystem>
#include <cstdio>
#include <cwctype>
#include <cstdint>
#include <mutex>
#include <regex>
#include <set>
#include <string>
#include <vector>
#include <shellapi.h>
#include <shlobj.h>
#include <wil/resource.h>
#include <windows.h>

namespace {
    constexpr wchar_t kLogFolderName[] = L"CosmoDownloader";
    constexpr wchar_t kLogSubfolderName[] = L"logs";
    constexpr wchar_t kLogFileName[] = L"download.log";
    std::mutex gLogMutex;
    std::mutex gDownloadStateMutex;
    HANDLE gActiveDownloadProcess = nullptr;
    bool gDownloadCancellationRequested = false;

    int ParseProgressPercent(const std::string& line);

    struct YtDlpCommandOptions {
        bool useCookiesFromBrowser = true;
        bool forceTargetFormat = true;
        bool includeAudioCodecSort = true;
        bool printFinalFilePath = false;
        std::wstring ffmpegLocation;
        std::wstring hardwareAccelerationMode = L"none";
    };

    struct MediaProbeResult {
        bool hasAny4KVideo = false;
        bool has4KInTargetFormat = false;
        bool hasRequestedAudioCodec = true;
    };

    enum class DownloadLifecyclePhase {
        Downloading,
        Merging,
        Converting,
    };

    struct PlaylistProgressState {
        bool isPlaylist = false;
        int currentItem = 1;
        int totalItems = 1;
        int itemProgress = 0;
    };

    struct DownloadExecutionState {
        DownloadLifecyclePhase phase = DownloadLifecyclePhase::Downloading;
        PlaylistProgressState playlist = {};
    };

    void ResetDownloadCancellationState() {
        std::lock_guard<std::mutex> lock(gDownloadStateMutex);
        gDownloadCancellationRequested = false;
    }

    bool IsDownloadCancellationRequested() {
        std::lock_guard<std::mutex> lock(gDownloadStateMutex);
        return gDownloadCancellationRequested;
    }

    void RegisterActiveDownloadProcess(HANDLE processHandle) {
        HANDLE duplicatedHandle = nullptr;
        const BOOL duplicated = DuplicateHandle(
            GetCurrentProcess(),
            processHandle,
            GetCurrentProcess(),
            &duplicatedHandle,
            PROCESS_TERMINATE | SYNCHRONIZE,
            FALSE,
            0
        );

        if (!duplicated) {
            return;
        }

        std::lock_guard<std::mutex> lock(gDownloadStateMutex);
        if (gActiveDownloadProcess != nullptr) {
            CloseHandle(gActiveDownloadProcess);
            gActiveDownloadProcess = nullptr;
        }

        gActiveDownloadProcess = duplicatedHandle;
        if (gDownloadCancellationRequested) {
            TerminateProcess(gActiveDownloadProcess, 1);
        }
    }

    void ClearActiveDownloadProcess() {
        std::lock_guard<std::mutex> lock(gDownloadStateMutex);
        if (gActiveDownloadProcess != nullptr) {
            CloseHandle(gActiveDownloadProcess);
            gActiveDownloadProcess = nullptr;
        }
    }

    std::wstring Utf8ToWide(const std::string& text) {
        if (text.empty()) {
            return L"";
        }

        const int wideCount = MultiByteToWideChar(
            CP_UTF8,
            0,
            text.data(),
            static_cast<int>(text.size()),
            nullptr,
            0
        );
        if (wideCount <= 0) {
            return L"";
        }

        std::wstring wide(static_cast<size_t>(wideCount), L'\0');
        MultiByteToWideChar(
            CP_UTF8,
            0,
            text.data(),
            static_cast<int>(text.size()),
            wide.data(),
            wideCount
        );
        return wide;
    }

    std::wstring GetLocalAppDataDirectory() {
        wil::unique_cotaskmem_string localAppDataPath;
        if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, localAppDataPath.put()))) {
            return L"";
        }

        return std::wstring(localAppDataPath.get());
    }

    std::wstring GetLogDirectoryPath() {
        const std::wstring localAppDataDirectory = GetLocalAppDataDirectory();
        const std::wstring baseDirectory = !localAppDataDirectory.empty()
            ? localAppDataDirectory
            : GetExecutableDirectoryPath();

        if (baseDirectory.empty()) {
            return L"";
        }

        return baseDirectory + L"\\" + kLogFolderName + L"\\" + kLogSubfolderName;
    }

    std::wstring GetDownloadLogFilePathInternal() {
        const std::wstring logDirectory = GetLogDirectoryPath();
        if (logDirectory.empty()) {
            return kLogFileName;
        }

        return logDirectory + L"\\" + kLogFileName;
    }

    void EnsureLogDirectoryExists(const std::wstring& directoryPath) {
        if (directoryPath.empty()) {
            return;
        }

        SHCreateDirectoryExW(nullptr, directoryPath.c_str(), nullptr);
    }

    void EnsureLogFileExists(const std::wstring& logFilePath) {
        HANDLE logFile = CreateFileW(
            logFilePath.c_str(),
            FILE_APPEND_DATA,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            nullptr,
            OPEN_ALWAYS,
            FILE_ATTRIBUTE_NORMAL,
            nullptr
        );

        if (logFile != INVALID_HANDLE_VALUE) {
            CloseHandle(logFile);
        }
    }

    std::string WideToUtf8(const std::wstring& text) {
        if (text.empty()) {
            return "";
        }

        const int byteCount = WideCharToMultiByte(
            CP_UTF8,
            0,
            text.c_str(),
            static_cast<int>(text.size()),
            nullptr,
            0,
            nullptr,
            nullptr
        );
        if (byteCount <= 0) {
            return "";
        }

        std::string utf8(static_cast<size_t>(byteCount), '\0');
        WideCharToMultiByte(
            CP_UTF8,
            0,
            text.c_str(),
            static_cast<int>(text.size()),
            utf8.data(),
            byteCount,
            nullptr,
            nullptr
        );
        return utf8;
    }

    std::string BuildLogTimestampPrefix() {
        SYSTEMTIME now = {};
        GetLocalTime(&now);

        char buffer[32] = {};
        std::snprintf(
            buffer,
            sizeof(buffer),
            "[%04u-%02u-%02u %02u:%02u:%02u] ",
            now.wYear,
            now.wMonth,
            now.wDay,
            now.wHour,
            now.wMinute,
            now.wSecond
        );
        return std::string(buffer);
    }

    void AppendUtf8LogLine(const std::string& line) {
        std::lock_guard<std::mutex> lock(gLogMutex);

        const std::wstring logDirectory = GetLogDirectoryPath();
        const std::wstring logFilePath = GetDownloadLogFilePathInternal();
        EnsureLogDirectoryExists(logDirectory);
        EnsureLogFileExists(logFilePath);

        HANDLE logFile = CreateFileW(
            logFilePath.c_str(),
            FILE_APPEND_DATA,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            nullptr,
            OPEN_ALWAYS,
            FILE_ATTRIBUTE_NORMAL,
            nullptr
        );
        if (logFile == INVALID_HANDLE_VALUE) {
            return;
        }

        std::string payload = BuildLogTimestampPrefix();
        payload += line;
        payload += "\r\n";

        DWORD bytesWritten = 0;
        WriteFile(logFile, payload.data(), static_cast<DWORD>(payload.size()), &bytesWritten, nullptr);
        CloseHandle(logFile);
    }

    void AppendWideLogLine(const std::wstring& line) {
        AppendUtf8LogLine(WideToUtf8(line));
    }

    bool IsSupportedVideoCodec(const std::wstring& codec) {
        return codec == L"auto"
            || codec == L"av01"
            || codec == L"vp9"
            || codec == L"h265"
            || codec == L"h264";
    }

    bool IsSupportedAudioCodec(const std::wstring& codec) {
        return codec == L"auto"
            || codec == L"opus"
            || codec == L"vorbis"
            || codec == L"aac"
            || codec == L"mp4a"
            || codec == L"mp3";
    }

    std::wstring NormalizeVideoCodec(const std::wstring& codec) {
        if (IsSupportedVideoCodec(codec)) {
            return codec;
        }

        return L"auto";
    }

    std::wstring NormalizeAudioCodec(const std::wstring& codec) {
        if (IsSupportedAudioCodec(codec)) {
            return codec;
        }

        return L"auto";
    }

    bool IsSupportedCookieBrowser(const std::wstring& browser) {
        static const std::array<std::wstring, 9> supportedBrowsers = {
            L"brave",
            L"chrome",
            L"chromium",
            L"edge",
            L"firefox",
            L"opera",
            L"safari",
            L"vivaldi",
            L"whale",
        };

        return std::find(supportedBrowsers.begin(), supportedBrowsers.end(), browser) != supportedBrowsers.end();
    }

    std::wstring NormalizeCookieBrowser(const std::wstring& browser) {
        if (browser.empty()) {
            return L"";
        }

        std::wstring normalized = browser;
        std::transform(
            normalized.begin(),
            normalized.end(),
            normalized.begin(),
            [](wchar_t ch) { return static_cast<wchar_t>(std::towlower(ch)); }
        );

        if (normalized == L"default") {
            return L"";
        }

        return IsSupportedCookieBrowser(normalized) ? normalized : L"";
    }

    std::wstring ToLowerWide(std::wstring value) {
        std::transform(
            value.begin(),
            value.end(),
            value.begin(),
            [](wchar_t ch) { return static_cast<wchar_t>(std::towlower(ch)); }
        );
        return value;
    }

    bool IsAudioOnlyFormat(const std::wstring& format) {
        const std::wstring normalizedFormat = ToLowerWide(format);
        return normalizedFormat == L"mp3" || normalizedFormat == L"wav";
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

    std::wstring BuildFormatSortExpression(
        bool isAudioDownload,
        const std::wstring& videoCodec,
        const std::wstring& audioCodec
    ) {
        std::vector<std::wstring> sortFields;

        if (!isAudioDownload && videoCodec != L"auto") {
            sortFields.push_back(L"vcodec:" + videoCodec);
        }

        if (audioCodec != L"auto") {
            sortFields.push_back(L"acodec:" + audioCodec);
        }

        return JoinWithComma(sortFields);
    }

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

    void PostPlaylistProgress(ICoreWebView2* webviewPtr, int currentItem, int totalItems) {
        if (webviewPtr == nullptr) {
            return;
        }

        const int safeTotal = (std::max)(1, totalItems);
        const int safeCurrent = std::clamp(currentItem, 1, safeTotal);
        const std::wstring message = L"status:playlist:" + std::to_wstring(safeCurrent) + L":" + std::to_wstring(safeTotal);
        webviewPtr->PostWebMessageAsString(message.c_str());
    }

    const wchar_t* ToStatusMessage(DownloadLifecyclePhase phase) {
        switch (phase) {
        case DownloadLifecyclePhase::Merging:
            return L"status:merging";
        case DownloadLifecyclePhase::Converting:
            return L"status:converting";
        case DownloadLifecyclePhase::Downloading:
        default:
            return L"status:downloading";
        }
    }

    std::wstring BuildYtDlpCommand(
        const std::wstring& ytDlpPath,
        const std::wstring& url,
        const std::wstring& outputPath,
        const std::wstring& format,
        int resolution,
        int bitrate,
        int fps,
        const std::wstring& videoCodec,
        const std::wstring& audioCodec,
        const std::wstring& browserForCookies,
        const YtDlpCommandOptions& options
    ) {
        std::wstring command = L"\"" + ytDlpPath + L"\" --newline --progress";

        const bool isAudio = IsAudioOnlyFormat(format);
        const std::wstring safeVideoCodec = NormalizeVideoCodec(videoCodec);
        const std::wstring safeAudioCodec = options.includeAudioCodecSort
            ? NormalizeAudioCodec(audioCodec)
            : L"auto";
        const std::wstring safeCookieBrowser = NormalizeCookieBrowser(browserForCookies);
        const std::wstring formatSortExpression = BuildFormatSortExpression(isAudio, safeVideoCodec, safeAudioCodec);
        const std::wstring normalizedHwMode = NormalizeHardwareAccelerationMode(options.hardwareAccelerationMode);

        if (!options.ffmpegLocation.empty()) {
            command += L" --ffmpeg-location \"" + options.ffmpegLocation + L"\"";
        }

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
            if (options.forceTargetFormat) {
                command += L" --merge-output-format " + format;
            }
        }

        if (!formatSortExpression.empty()) {
            command += L" -S \"" + formatSortExpression + L"\"";
        }

        if (options.useCookiesFromBrowser && !safeCookieBrowser.empty()) {
            command += L" --cookies-from-browser " + safeCookieBrowser;
        }

        if (normalizedHwMode != L"none") {
            command += L" --postprocessor-args \"ffmpeg_i:-hwaccel " + normalizedHwMode + L"\"";
        }

        if (options.printFinalFilePath) {
            command += L" --print after_move:filepath";
        }

        command += L" -o \"" + outputPath + L"\" \"" + url + L"\"";
        return command;
    }

    std::wstring BuildMetadataCommand(
        const std::wstring& ytDlpPath,
        const std::wstring& url,
        const std::wstring& browserForCookies,
        bool useCookiesFromBrowser
    ) {
        std::wstring command = L"\"" + ytDlpPath + L"\" --dump-single-json --no-playlist --skip-download --no-warnings";

        const std::wstring safeCookieBrowser = NormalizeCookieBrowser(browserForCookies);
        if (useCookiesFromBrowser && !safeCookieBrowser.empty()) {
            command += L" --cookies-from-browser " + safeCookieBrowser;
        }

        command += L" \"" + url + L"\"";
        return command;
    }

    std::wstring BuildThumbnailCommand(
        const std::wstring& ytDlpPath,
        const std::wstring& url,
        const std::wstring& outputPath,
        const std::wstring& browserForCookies,
        bool useCookiesFromBrowser
    ) {
        std::wstring command = L"\"" + ytDlpPath + L"\" --skip-download --write-thumbnail --convert-thumbnails jpg --no-warnings";

        const std::wstring safeCookieBrowser = NormalizeCookieBrowser(browserForCookies);
        if (useCookiesFromBrowser && !safeCookieBrowser.empty()) {
            command += L" --cookies-from-browser " + safeCookieBrowser;
        }

        command += L" -o \"" + outputPath + L"\" \"" + url + L"\"";
        return command;
    }

    std::string JoinOutputLines(const std::vector<std::string>& lines) {
        std::string result;
        for (const auto& line : lines) {
            if (!result.empty()) {
                result.push_back('\n');
            }
            result += line;
        }

        return result;
    }

    std::string ExtractJsonPayload(const std::string& text) {
        const size_t firstBrace = text.find('{');
        const size_t lastBrace = text.rfind('}');
        if (firstBrace == std::string::npos || lastBrace == std::string::npos || firstBrace > lastBrace) {
            return "";
        }

        return text.substr(firstBrace, lastBrace - firstBrace + 1);
    }

    std::string UnescapeJsonString(const std::string& value) {
        std::string result;
        result.reserve(value.size());

        for (size_t index = 0; index < value.size(); ++index) {
            const char current = value[index];
            if (current != '\\' || index + 1 >= value.size()) {
                result.push_back(current);
                continue;
            }

            const char escaped = value[++index];
            switch (escaped) {
            case '"':
                result.push_back('"');
                break;
            case '\\':
                result.push_back('\\');
                break;
            case '/':
                result.push_back('/');
                break;
            case 'b':
                result.push_back('\b');
                break;
            case 'f':
                result.push_back('\f');
                break;
            case 'n':
                result.push_back('\n');
                break;
            case 'r':
                result.push_back('\r');
                break;
            case 't':
                result.push_back('\t');
                break;
            case 'u':
                if (index + 4 < value.size()) {
                    const std::string hex = value.substr(index + 1, 4);
                    try {
                        const unsigned int codePoint = std::stoul(hex, nullptr, 16);
                        if (codePoint <= 0x7F) {
                            result.push_back(static_cast<char>(codePoint));
                        }
                    }
                    catch (...) {
                    }
                    index += 4;
                }
                break;
            default:
                result.push_back(escaped);
                break;
            }
        }

        return result;
    }

    std::vector<int> ParseIntegerMatches(
        const std::string& json,
        const std::regex& pattern,
        int minValue,
        int maxValue,
        bool roundValue
    ) {
        std::set<int> uniqueValues;
        for (std::sregex_iterator iterator(json.begin(), json.end(), pattern), end; iterator != end; ++iterator) {
            if ((*iterator).size() < 2) {
                continue;
            }

            try {
                int value = 0;
                if (roundValue) {
                    const double parsed = std::stod((*iterator)[1].str());
                    value = static_cast<int>(std::lround(parsed));
                }
                else {
                    value = std::stoi((*iterator)[1].str());
                }

                if (value >= minValue && value <= maxValue) {
                    uniqueValues.insert(value);
                }
            }
            catch (...) {
            }
        }

        return std::vector<int>(uniqueValues.begin(), uniqueValues.end());
    }

    std::wstring ParseThumbnailUrl(const std::string& json) {
        static const std::regex thumbnailPattern(R"thumb("thumbnail"\s*:\s*"((?:\\.|[^"\\])*)")thumb");
        std::smatch match;
        if (!std::regex_search(json, match, thumbnailPattern) || match.size() < 2) {
            return L"";
        }

        const std::string unescaped = UnescapeJsonString(match[1].str());
        return Utf8ToWide(unescaped);
    }

    std::string ToLowerAscii(std::string value) {
        std::transform(
            value.begin(),
            value.end(),
            value.begin(),
            [](unsigned char ch) {
                return static_cast<char>(std::tolower(ch));
            }
        );
        return value;
    }

    std::string EscapeRegex(const std::string& text) {
        std::string escaped;
        escaped.reserve(text.size() * 2);
        static const std::string regexSpecial = R"(\.^$|()[]{}*+?-)";
        for (const char ch : text) {
            if (regexSpecial.find(ch) != std::string::npos) {
                escaped.push_back('\\');
            }
            escaped.push_back(ch);
        }
        return escaped;
    }

    bool HasAny4KVideo(const std::string& json) {
        static const std::regex kAny4KPattern(R"("height"\s*:\s*(21[6-9][0-9]|2[2-9][0-9]{2}|[3-9][0-9]{3}))");
        return std::regex_search(json, kAny4KPattern);
    }

    bool Has4KInTargetFormat(const std::string& json, const std::wstring& format) {
        const std::string formatUtf8 = ToLowerAscii(WideToUtf8(format));
        if (formatUtf8.empty()) {
            return false;
        }

        const std::string escapedFormat = EscapeRegex(formatUtf8);
        const std::regex heightThenExt(
            "\\{[^\\{\\}]*\"height\"\\s*:\\s*(?:21[6-9][0-9]|2[2-9][0-9]{2}|[3-9][0-9]{3})[^\\{\\}]*\"ext\"\\s*:\\s*\"" +
            escapedFormat +
            "\"[^\\{\\}]*\\}"
        );
        if (std::regex_search(json, heightThenExt)) {
            return true;
        }

        const std::regex extThenHeight(
            "\\{[^\\{\\}]*\"ext\"\\s*:\\s*\"" +
            escapedFormat +
            "\"[^\\{\\}]*\"height\"\\s*:\\s*(?:21[6-9][0-9]|2[2-9][0-9]{2}|[3-9][0-9]{3})[^\\{\\}]*\\}"
        );
        return std::regex_search(json, extThenHeight);
    }

    std::set<std::string> ParseAvailableAudioCodecs(const std::string& json) {
        static const std::regex codecPattern(R"codec("acodec"\s*:\s*"([^"]+)")codec");
        std::set<std::string> codecs;

        for (std::sregex_iterator iterator(json.begin(), json.end(), codecPattern), end; iterator != end; ++iterator) {
            if ((*iterator).size() < 2) {
                continue;
            }

            const std::string codec = ToLowerAscii((*iterator)[1].str());
            if (codec.empty() || codec == "none") {
                continue;
            }

            codecs.insert(codec);
        }

        return codecs;
    }

    bool HasHardwareAccelerationPostprocessingFailure(const std::vector<std::string>& outputLines) {
        for (const std::string& line : outputLines) {
            const std::string normalized = ToLowerAscii(line);
            if (normalized.find("option hwaccel") != std::string::npos) {
                return true;
            }

            if (
                normalized.find("cannot be applied to output url") != std::string::npos &&
                normalized.find("hwaccel") != std::string::npos
                ) {
                return true;
            }

            if (
                normalized.find("error opening output files: invalid argument") != std::string::npos &&
                normalized.find("postprocessing") != std::string::npos
                ) {
                return true;
            }
        }

        return false;
    }

    bool HasRequestedAudioCodec(const std::set<std::string>& codecs, const std::wstring& requestedCodec) {
        const std::wstring safeCodec = NormalizeAudioCodec(requestedCodec);
        if (safeCodec == L"auto") {
            return true;
        }

        const std::string codec = ToLowerAscii(WideToUtf8(safeCodec));
        if (codec.empty()) {
            return true;
        }

        if (codec == "aac" || codec == "mp4a") {
            return std::any_of(codecs.begin(), codecs.end(), [](const std::string& value) {
                return value == "aac" || value.rfind("mp4a", 0) == 0;
                });
        }

        return codecs.find(codec) != codecs.end();
    }

    MediaProbeResult BuildMediaProbeResult(
        const std::string& metadataJson,
        const std::wstring& requestedFormat,
        const std::wstring& requestedAudioCodec,
        bool isAudioDownload
    ) {
        MediaProbeResult result = {};
        if (metadataJson.empty() || isAudioDownload) {
            return result;
        }

        result.hasAny4KVideo = HasAny4KVideo(metadataJson);
        result.has4KInTargetFormat = Has4KInTargetFormat(metadataJson, requestedFormat);

        const std::set<std::string> codecs = ParseAvailableAudioCodecs(metadataJson);
        result.hasRequestedAudioCodec = HasRequestedAudioCodec(codecs, requestedAudioCodec);
        return result;
    }

    bool TryParsePlaylistPosition(const std::string& line, int& currentItem, int& totalItems) {
        static const std::regex itemPattern(
            R"(Downloading\s+(?:item|video|entry|episode|chapter)\s+(\d+)\s+of\s+(\d+))",
            std::regex_constants::icase
        );
        static const std::regex genericPattern(
            R"(Downloading\s+(\d+)\s+of\s+(\d+))",
            std::regex_constants::icase
        );

        std::smatch match;
        const bool matched = std::regex_search(line, match, itemPattern)
            || std::regex_search(line, match, genericPattern);
        if (!matched || match.size() < 3) {
            return false;
        }

        try {
            currentItem = std::stoi(match[1].str());
            totalItems = std::stoi(match[2].str());
        }
        catch (...) {
            return false;
        }

        if (currentItem <= 0 || totalItems <= 0 || currentItem > totalItems) {
            return false;
        }

        return true;
    }

    bool TryDetectLifecyclePhase(const std::string& line, DownloadLifecyclePhase& phase) {
        const std::string normalized = ToLowerAscii(line);
        if (
            normalized.find("[merger]") != std::string::npos ||
            normalized.find("merging formats into") != std::string::npos
        ) {
            phase = DownloadLifecyclePhase::Merging;
            return true;
        }

        if (
            normalized.find("[extractaudio]") != std::string::npos ||
            normalized.find("[videoremuxer]") != std::string::npos ||
            normalized.find("[videoconvertor]") != std::string::npos ||
            normalized.find("remuxing video") != std::string::npos
        ) {
            phase = DownloadLifecyclePhase::Converting;
            return true;
        }

        return false;
    }

    int CalculateOverallProgress(
        const PlaylistProgressState& playlistState,
        int itemProgress
    ) {
        const int safeItemProgress = std::clamp(itemProgress, 0, 100);
        if (!playlistState.isPlaylist || playlistState.totalItems <= 1) {
            return safeItemProgress;
        }

        const int completedItems = std::clamp(playlistState.currentItem - 1, 0, playlistState.totalItems);
        const double totalProgress = (static_cast<double>(completedItems) * 100.0 + safeItemProgress)
            / static_cast<double>(playlistState.totalItems);
        return std::clamp(static_cast<int>(std::lround(totalProgress)), 0, 100);
    }

    bool ExecuteYtDlpCommand(
        const std::wstring& commandLine,
        ICoreWebView2* webviewPtr,
        int& lastProgress,
        std::vector<std::string>* capturedOutputLines = nullptr,
        bool registerDownloadProcess = false,
        DownloadExecutionState* executionState = nullptr
    ) {
        AppendWideLogLine(L"Executing command: " + commandLine);

        std::vector<wchar_t> commandBuffer(commandLine.begin(), commandLine.end());
        commandBuffer.push_back(L'\0');

        SECURITY_ATTRIBUTES securityAttributes = {};
        securityAttributes.nLength = sizeof(SECURITY_ATTRIBUTES);
        securityAttributes.bInheritHandle = TRUE;

        HANDLE readPipe = nullptr;
        HANDLE writePipe = nullptr;

        if (!CreatePipe(&readPipe, &writePipe, &securityAttributes, 0)) {
            AppendWideLogLine(L"CreatePipe failed. Error code: " + std::to_wstring(GetLastError()));
            return false;
        }

        if (!SetHandleInformation(readPipe, HANDLE_FLAG_INHERIT, 0)) {
            AppendWideLogLine(L"SetHandleInformation failed. Error code: " + std::to_wstring(GetLastError()));
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
            AppendWideLogLine(L"CreateProcessW failed. Error code: " + std::to_wstring(GetLastError()));
            CloseHandle(readPipe);
            return false;
        }

        if (registerDownloadProcess) {
            RegisterActiveDownloadProcess(processInfo.hProcess);
        }
        const auto clearActiveProcessScope = wil::scope_exit([registerDownloadProcess]() {
            if (registerDownloadProcess) {
                ClearActiveDownloadProcess();
            }
        });

        std::string pendingLine;
        char buffer[4096] = {};
        DWORD bytesRead = 0;

        auto handleOutputLine = [&](const std::string& outputLine) {
            if (outputLine.empty()) {
                return;
            }

            AppendUtf8LogLine(outputLine);
            if (capturedOutputLines != nullptr) {
                capturedOutputLines->push_back(outputLine);
            }

            if (executionState != nullptr) {
                int playlistCurrentItem = 0;
                int playlistTotalItems = 0;
                if (TryParsePlaylistPosition(outputLine, playlistCurrentItem, playlistTotalItems)) {
                    const bool itemChanged = executionState->playlist.currentItem != playlistCurrentItem;
                    executionState->playlist.isPlaylist = playlistTotalItems > 1;
                    executionState->playlist.currentItem = playlistCurrentItem;
                    executionState->playlist.totalItems = playlistTotalItems;
                    if (itemChanged) {
                        executionState->playlist.itemProgress = 0;
                    }

                    PostPlaylistProgress(
                        webviewPtr,
                        executionState->playlist.currentItem,
                        executionState->playlist.totalItems
                    );
                }

                DownloadLifecyclePhase detectedPhase = DownloadLifecyclePhase::Downloading;
                if (
                    TryDetectLifecyclePhase(outputLine, detectedPhase) &&
                    executionState->phase != detectedPhase
                ) {
                    executionState->phase = detectedPhase;
                    PostStatus(webviewPtr, ToStatusMessage(executionState->phase));
                }
            }

            const int progress = ParseProgressPercent(outputLine);
            if (progress < 0) {
                return;
            }

            int nextProgress = progress;
            if (executionState != nullptr) {
                executionState->playlist.itemProgress = progress;
                const std::string normalizedLine = ToLowerAscii(outputLine);
                const bool isDownloadProgressLine = normalizedLine.find("[download]") != std::string::npos;
                if (
                    executionState->phase != DownloadLifecyclePhase::Downloading &&
                    isDownloadProgressLine
                ) {
                    executionState->phase = DownloadLifecyclePhase::Downloading;
                    PostStatus(webviewPtr, ToStatusMessage(executionState->phase));
                }

                nextProgress = CalculateOverallProgress(executionState->playlist, progress);
            }

            if (nextProgress != lastProgress) {
                lastProgress = nextProgress;
                PostProgress(webviewPtr, lastProgress);
            }
        };

        while (ReadFile(readPipe, buffer, sizeof(buffer), &bytesRead, nullptr) && bytesRead > 0) {
            pendingLine.append(buffer, buffer + bytesRead);

            size_t newlinePosition = pendingLine.find('\n');
            while (newlinePosition != std::string::npos) {
                std::string line = pendingLine.substr(0, newlinePosition);
                if (!line.empty() && line.back() == '\r') {
                    line.pop_back();
                }

                handleOutputLine(line);

                pendingLine.erase(0, newlinePosition + 1);
                newlinePosition = pendingLine.find('\n');
            }
        }

        if (!pendingLine.empty()) {
            handleOutputLine(pendingLine);
        }

        CloseHandle(readPipe);

        WaitForSingleObject(processInfo.hProcess, INFINITE);

        DWORD exitCode = 1;
        GetExitCodeProcess(processInfo.hProcess, &exitCode);
        AppendWideLogLine(L"Command exit code: " + std::to_wstring(exitCode));

        CloseHandle(processInfo.hProcess);
        CloseHandle(processInfo.hThread);

        return exitCode == 0;
    }

    std::wstring TrimWide(std::wstring value) {
        value.erase(value.begin(), std::find_if(value.begin(), value.end(), [](wchar_t ch) {
            return !std::iswspace(ch);
            }));
        value.erase(std::find_if(value.rbegin(), value.rend(), [](wchar_t ch) {
            return !std::iswspace(ch);
            }).base(), value.end());
        return value;
    }

    bool TryDecodeWithCodePage(
        const std::string& text,
        UINT codePage,
        DWORD flags,
        std::wstring& decoded
    ) {
        decoded.clear();
        if (text.empty()) {
            return false;
        }

        const int wideCount = MultiByteToWideChar(
            codePage,
            flags,
            text.data(),
            static_cast<int>(text.size()),
            nullptr,
            0
        );
        if (wideCount <= 0) {
            return false;
        }

        decoded.resize(static_cast<size_t>(wideCount));
        const int written = MultiByteToWideChar(
            codePage,
            flags,
            text.data(),
            static_cast<int>(text.size()),
            decoded.data(),
            wideCount
        );
        if (written <= 0) {
            decoded.clear();
            return false;
        }

        decoded.resize(static_cast<size_t>(written));
        return true;
    }

    std::wstring DecodeProcessOutputToWide(const std::string& text) {
        std::wstring decoded;
        if (TryDecodeWithCodePage(text, CP_UTF8, MB_ERR_INVALID_CHARS, decoded)) {
            return decoded;
        }

        if (TryDecodeWithCodePage(text, CP_ACP, 0, decoded)) {
            return decoded;
        }

        if (TryDecodeWithCodePage(text, CP_OEMCP, 0, decoded)) {
            return decoded;
        }

        return L"";
    }

    std::wstring ExtractWindowsPathFromText(const std::wstring& line) {
        std::wstring candidate = TrimWide(line);
        if (candidate.empty()) {
            return L"";
        }

        if (candidate.front() == L'"' && candidate.back() == L'"' && candidate.size() > 1) {
            candidate = TrimWide(candidate.substr(1, candidate.size() - 2));
        }

        const auto hasDrivePrefix = [](const std::wstring& value, size_t offset) {
            return value.size() > offset + 2
                && std::iswalpha(value[offset]) != 0
                && value[offset + 1] == L':'
                && (value[offset + 2] == L'\\' || value[offset + 2] == L'/');
        };

        if (!hasDrivePrefix(candidate, 0) && candidate.rfind(L"\\\\", 0) != 0) {
            for (size_t index = 0; index + 2 < candidate.size(); ++index) {
                if (hasDrivePrefix(candidate, index)) {
                    candidate = candidate.substr(index);
                    break;
                }
            }
        }

        const size_t escapePosition = candidate.find(L'\x1b');
        if (escapePosition != std::wstring::npos) {
            candidate.erase(escapePosition);
        }

        candidate = TrimWide(candidate);
        if (candidate.empty()) {
            return L"";
        }
        if (candidate.front() == L'"' && candidate.back() == L'"' && candidate.size() > 1) {
            candidate = TrimWide(candidate.substr(1, candidate.size() - 2));
        }

        return candidate;
    }

    bool IsExistingRegularFile(const std::wstring& path) {
        if (path.empty()) {
            return false;
        }

        const DWORD attributes = GetFileAttributesW(path.c_str());
        if (attributes == INVALID_FILE_ATTRIBUTES) {
            return false;
        }

        return (attributes & FILE_ATTRIBUTE_DIRECTORY) == 0;
    }

    std::wstring FindMostRecentDownloadedFile(
        const std::wstring& outputDirectory,
        const std::filesystem::file_time_type& notOlderThan
    ) {
        if (outputDirectory.empty()) {
            return L"";
        }

        std::error_code error;
        const std::filesystem::path directoryPath(outputDirectory);
        if (!std::filesystem::exists(directoryPath, error) || !std::filesystem::is_directory(directoryPath, error)) {
            return L"";
        }

        std::filesystem::path newestAnyPath;
        std::filesystem::file_time_type newestAnyWriteTime = {};
        bool hasAnyFile = false;

        std::filesystem::path newestRecentPath;
        std::filesystem::file_time_type newestRecentWriteTime = {};
        bool hasRecentFile = false;

        for (const auto& entry : std::filesystem::directory_iterator(directoryPath, std::filesystem::directory_options::skip_permission_denied, error)) {
            if (error) {
                error.clear();
                continue;
            }

            const bool isRegularFile = entry.is_regular_file(error);
            if (error || !isRegularFile) {
                error.clear();
                continue;
            }

            const std::wstring extension = ToLowerWide(entry.path().extension().wstring());
            if (extension == L".part" || extension == L".ytdl" || extension == L".tmp") {
                continue;
            }

            const auto writeTime = entry.last_write_time(error);
            if (error) {
                error.clear();
                continue;
            }

            if (!hasAnyFile || writeTime > newestAnyWriteTime) {
                newestAnyWriteTime = writeTime;
                newestAnyPath = entry.path();
                hasAnyFile = true;
            }

            if (writeTime >= notOlderThan && (!hasRecentFile || writeTime > newestRecentWriteTime)) {
                newestRecentWriteTime = writeTime;
                newestRecentPath = entry.path();
                hasRecentFile = true;
            }
        }

        if (hasRecentFile) {
            return newestRecentPath.wstring();
        }

        if (hasAnyFile) {
            return newestAnyPath.wstring();
        }

        return L"";
    }

    std::wstring ExtractFinalFilePath(const std::vector<std::string>& outputLines) {
        for (auto iterator = outputLines.rbegin(); iterator != outputLines.rend(); ++iterator) {
            std::wstring candidate = ExtractWindowsPathFromText(DecodeProcessOutputToWide(*iterator));
            if (candidate.empty()) {
                continue;
            }

            if (!IsExistingRegularFile(candidate)) {
                continue;
            }

            return candidate;
        }

        return L"";
    }

    std::wstring ResolveYtDlpExecutable() {
        return ResolveBundledOrSystemExecutable(L"yt-dlp.exe");
    }

    std::wstring ResolveFFmpegLocationForYtDlp() {
        const std::wstring ffmpegPath = ResolveFFmpegExecutable();
        if (ffmpegPath.empty()) {
            return L"";
        }

        std::filesystem::path path(ffmpegPath);
        const std::filesystem::path directory = path.parent_path();
        if (directory.empty()) {
            return ffmpegPath;
        }

        return directory.wstring();
    }

    bool FetchMetadataJson(
        const std::wstring& ytDlpPath,
        const std::wstring& url,
        const std::wstring& browserForCookies,
        std::string& metadataJson
    ) {
        metadataJson.clear();

        int lastProgress = 0;
        std::vector<std::string> outputLines;

        const std::wstring commandLine = BuildMetadataCommand(
            ytDlpPath,
            url,
            browserForCookies,
            true
        );

        bool completed = ExecuteYtDlpCommand(commandLine, nullptr, lastProgress, &outputLines);
        const bool hasSelectedCookieBrowser = !NormalizeCookieBrowser(browserForCookies).empty();
        if (!completed && hasSelectedCookieBrowser) {
            AppendWideLogLine(L"Metadata fetch failed with browser cookies. Retrying without cookies.");

            outputLines.clear();
            const std::wstring fallbackCommandLine = BuildMetadataCommand(
                ytDlpPath,
                url,
                browserForCookies,
                false
            );

            completed = ExecuteYtDlpCommand(fallbackCommandLine, nullptr, lastProgress, &outputLines);
        }

        if (!completed) {
            return false;
        }

        const std::string payload = JoinOutputLines(outputLines);
        metadataJson = ExtractJsonPayload(payload);
        return !metadataJson.empty();
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
}

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
) {
    ResetDownloadCancellationState();
    ClearActiveDownloadProcess();
    const std::wstring normalizedHwMode = NormalizeHardwareAccelerationMode(hardwareAccelerationMode);

    AppendWideLogLine(L"------------------------------------------------------------");
    AppendWideLogLine(L"Download started");
    AppendWideLogLine(L"URL: " + url);
    AppendWideLogLine(L"Target directory: " + path);
    AppendWideLogLine(L"Format: " + format);
    AppendWideLogLine(L"Resolution: " + std::to_wstring(resolution));
    AppendWideLogLine(L"Bitrate: " + std::to_wstring(bitrate));
    AppendWideLogLine(L"FPS: " + std::to_wstring(fps));
    AppendWideLogLine(L"Video codec: " + videoCodec);
    AppendWideLogLine(L"Audio codec: " + audioCodec);
    AppendWideLogLine(L"Cookie browser: " + browserForCookies);
    AppendWideLogLine(L"Hardware acceleration mode: " + normalizedHwMode);

    const HRESULT coInitializeResult = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    const bool shouldCoUninitialize = SUCCEEDED(coInitializeResult) || coInitializeResult == RPC_E_CHANGED_MODE;
    const auto coUninitializeScope = wil::scope_exit([shouldCoUninitialize]() {
        if (shouldCoUninitialize) {
            CoUninitialize();
        }
    });

    PostStatus(webviewPtr, L"status:downloading");
    PostProgress(webviewPtr, 0);

    if (IsDownloadCancellationRequested()) {
        AppendWideLogLine(L"Download canceled before command execution.");
        PostStatus(webviewPtr, L"status:canceled");
        return;
    }

    const std::wstring ytDlpPath = ResolveYtDlpExecutable();
    if (ytDlpPath.empty()) {
        AppendWideLogLine(L"yt-dlp executable not found.");
        PostStatus(webviewPtr, L"status:error");
        return;
    }

    const std::wstring ffmpegLocation = ResolveFFmpegLocationForYtDlp();
    const bool ffmpegAvailable = !ResolveFFmpegExecutable().empty();
    const bool isAudioDownload = IsAudioOnlyFormat(format);

    bool needsFormatFallbackConversion = false;
    bool needsAudioCodecFallbackConversion = false;
    if (!isAudioDownload) {
        std::string metadataJson;
        if (FetchMetadataJson(ytDlpPath, url, browserForCookies, metadataJson)) {
            const MediaProbeResult probe = BuildMediaProbeResult(
                metadataJson,
                format,
                audioCodec,
                false
            );

            needsFormatFallbackConversion =
                resolution >= 2160 &&
                probe.hasAny4KVideo &&
                !probe.has4KInTargetFormat;

            needsAudioCodecFallbackConversion =
                NormalizeAudioCodec(audioCodec) != L"auto" &&
                !probe.hasRequestedAudioCodec;

            if (needsFormatFallbackConversion) {
                AppendWideLogLine(L"4K fallback strategy enabled: target format is missing for 4K streams.");
            }

            if (needsAudioCodecFallbackConversion) {
                AppendWideLogLine(L"Audio codec fallback strategy enabled: target audio codec is unavailable.");
            }
        }
        else {
            AppendWideLogLine(L"Metadata probe failed before download. Proceeding with standard strategy.");
        }
    }

    const bool shouldUsePostConversion =
        (needsFormatFallbackConversion || needsAudioCodecFallbackConversion) &&
        ffmpegAvailable;

    if ((needsFormatFallbackConversion || needsAudioCodecFallbackConversion) && !ffmpegAvailable) {
        AppendWideLogLine(L"Fallback conversion was needed, but ffmpeg is unavailable. Proceeding without post-conversion.");
    }

    const std::wstring outputPath = path + L"\\%(title)s.%(ext)s";

    YtDlpCommandOptions commandOptions = {};
    commandOptions.forceTargetFormat = !shouldUsePostConversion;
    commandOptions.includeAudioCodecSort = !needsAudioCodecFallbackConversion;
    commandOptions.printFinalFilePath = shouldUsePostConversion;
    commandOptions.ffmpegLocation = ffmpegLocation;
    commandOptions.hardwareAccelerationMode = normalizedHwMode;
    std::wstring effectiveHwMode = commandOptions.hardwareAccelerationMode;

    int lastProgress = 0;
    DownloadExecutionState executionState = {};
    std::wstring downloadedFilePath;

    auto executeDownloadWithOptions = [&](bool useCookies) {
        commandOptions.useCookiesFromBrowser = useCookies;
        executionState.phase = DownloadLifecyclePhase::Downloading;
        executionState.playlist = {};
        downloadedFilePath.clear();

        auto resolveDownloadedFilePath = [&](const std::vector<std::string>& outputLines, const std::filesystem::file_time_type commandStartTime) {
            if (!commandOptions.printFinalFilePath) {
                return;
            }

            downloadedFilePath = ExtractFinalFilePath(outputLines);
            if (downloadedFilePath.empty()) {
                const auto fallbackThreshold = commandStartTime - std::chrono::seconds(10);
                downloadedFilePath = FindMostRecentDownloadedFile(path, fallbackThreshold);
                if (!downloadedFilePath.empty()) {
                    AppendWideLogLine(L"Resolved downloaded file path by scanning output directory.");
                }
            }

            if (downloadedFilePath.empty()) {
                AppendWideLogLine(L"Failed to resolve final downloaded file path from yt-dlp output or directory scan.");
            }
            else {
                AppendWideLogLine(L"Resolved downloaded file path: " + downloadedFilePath);
            }
        };

        std::vector<std::string> outputLines;
        const auto commandStartTime = std::filesystem::file_time_type::clock::now();

        const std::wstring commandLine = BuildYtDlpCommand(
            ytDlpPath,
            url,
            outputPath,
            format,
            resolution,
            bitrate,
            fps,
            videoCodec,
            audioCodec,
            browserForCookies,
            commandOptions
        );

        const bool success = ExecuteYtDlpCommand(
            commandLine,
            webviewPtr,
            lastProgress,
            &outputLines,
            true,
            &executionState
        );
        if (success) {
            resolveDownloadedFilePath(outputLines, commandStartTime);
            return true;
        }

        const std::wstring activeHwMode = NormalizeHardwareAccelerationMode(commandOptions.hardwareAccelerationMode);
        if (
            activeHwMode != L"none" &&
            !IsDownloadCancellationRequested() &&
            HasHardwareAccelerationPostprocessingFailure(outputLines)
            ) {
            AppendWideLogLine(L"Hardware acceleration command failed during postprocessing. Retrying without hardware acceleration.");

            YtDlpCommandOptions fallbackOptions = commandOptions;
            fallbackOptions.hardwareAccelerationMode = L"none";

            outputLines.clear();
            executionState.phase = DownloadLifecyclePhase::Downloading;
            executionState.playlist = {};
            const auto fallbackCommandStartTime = std::filesystem::file_time_type::clock::now();
            const std::wstring fallbackCommandLine = BuildYtDlpCommand(
                ytDlpPath,
                url,
                outputPath,
                format,
                resolution,
                bitrate,
                fps,
                videoCodec,
                audioCodec,
                browserForCookies,
                fallbackOptions
            );

            const bool fallbackSuccess = ExecuteYtDlpCommand(
                fallbackCommandLine,
                webviewPtr,
                lastProgress,
                &outputLines,
                true,
                &executionState
            );
            if (fallbackSuccess) {
                commandOptions.hardwareAccelerationMode = L"none";
                effectiveHwMode = L"none";
                resolveDownloadedFilePath(outputLines, fallbackCommandStartTime);
                return true;
            }
        }

        return false;
    };

    bool completed = executeDownloadWithOptions(true);
    const bool canceledAfterPrimaryCommand = !completed && IsDownloadCancellationRequested();

    const bool hasSelectedCookieBrowser = !NormalizeCookieBrowser(browserForCookies).empty();
    if (!completed && !canceledAfterPrimaryCommand && hasSelectedCookieBrowser) {
        AppendWideLogLine(L"Primary command failed. Retrying without browser cookies.");
        completed = executeDownloadWithOptions(false);
    }

    if (completed && shouldUsePostConversion) {
        if (downloadedFilePath.empty()) {
            AppendWideLogLine(L"Post-conversion skipped because source file path could not be detected.");
            completed = false;
        }
        else {
            const std::filesystem::path sourcePath(downloadedFilePath);
            std::filesystem::path convertedPath = sourcePath;
            const std::wstring normalizedFormat = ToLowerWide(format);
            convertedPath.replace_extension(L"." + normalizedFormat);

            if (ToLowerWide(convertedPath.wstring()) == ToLowerWide(sourcePath.wstring())) {
                convertedPath = sourcePath.parent_path() / (sourcePath.stem().wstring() + L".converted." + normalizedFormat);
            }

            PostStatus(webviewPtr, L"status:converting");
            AppendWideLogLine(L"Running ffmpeg post-conversion: " + sourcePath.wstring() + L" -> " + convertedPath.wstring());

            FFmpegConversionRequest conversionRequest = {};
            conversionRequest.inputPath = sourcePath.wstring();
            conversionRequest.outputPath = convertedPath.wstring();
            conversionRequest.targetFormat = normalizedFormat;
            conversionRequest.videoCodec = videoCodec;
            conversionRequest.audioCodec = audioCodec;
            conversionRequest.audioBitrateKbps = bitrate;
            conversionRequest.hardwareAccelerationMode = effectiveHwMode;

            std::wstring conversionError;
            bool conversionCompleted = ConvertMediaWithFFmpeg(conversionRequest, conversionError);
            if (!conversionCompleted && NormalizeHardwareAccelerationMode(conversionRequest.hardwareAccelerationMode) != L"none") {
                AppendWideLogLine(L"ffmpeg post-conversion failed with hardware acceleration. Retrying without hardware acceleration.");
                conversionRequest.hardwareAccelerationMode = L"none";
                conversionCompleted = ConvertMediaWithFFmpeg(conversionRequest, conversionError);
                if (conversionCompleted) {
                    effectiveHwMode = L"none";
                }
            }

            if (conversionCompleted) {
                AppendWideLogLine(L"ffmpeg post-conversion completed successfully.");
                if (sourcePath != convertedPath) {
                    std::error_code removeError;
                    std::filesystem::remove(sourcePath, removeError);
                    if (removeError) {
                        AppendWideLogLine(L"Warning: could not remove intermediate source file: " + sourcePath.wstring());
                    }
                }
            }
            else {
                AppendWideLogLine(L"ffmpeg post-conversion failed: " + conversionError);
                completed = false;
            }
        }
    }

    if (!completed && IsDownloadCancellationRequested()) {
        AppendWideLogLine(L"Download canceled by user.");
        PostStatus(webviewPtr, L"status:canceled");
        return;
    }

    if (completed) {
        AppendWideLogLine(L"Download finished successfully.");
        if (lastProgress < 100) {
            PostProgress(webviewPtr, 100);
        }
        PostStatus(webviewPtr, L"status:done");
    }
    else {
        AppendWideLogLine(L"Download failed.");
        PostStatus(webviewPtr, L"status:error");
    }
}

bool FetchYtDlpMetadata(
    const std::wstring& url,
    const std::wstring& browserForCookies,
    YtDlpMetadata& metadata
) {
    metadata = YtDlpMetadata{};

    AppendWideLogLine(L"------------------------------------------------------------");
    AppendWideLogLine(L"Metadata fetch started");
    AppendWideLogLine(L"URL: " + url);
    AppendWideLogLine(L"Cookie browser: " + browserForCookies);

    const std::wstring ytDlpPath = ResolveYtDlpExecutable();
    if (ytDlpPath.empty()) {
        AppendWideLogLine(L"yt-dlp executable not found.");
        return false;
    }

    std::string json;
    if (!FetchMetadataJson(ytDlpPath, url, browserForCookies, json)) {
        AppendWideLogLine(L"Metadata fetch failed.");
        return false;
    }

    static const std::regex resolutionPattern(R"("height"\s*:\s*(\d+))");
    static const std::regex fpsPattern(R"("fps"\s*:\s*(-?\d+(?:\.\d+)?))");
    static const std::regex bitratePattern(R"("abr"\s*:\s*(-?\d+(?:\.\d+)?))");

    metadata.availableResolutions = ParseIntegerMatches(json, resolutionPattern, 1, 10000, false);
    metadata.availableFps = ParseIntegerMatches(json, fpsPattern, 1, 1000, true);
    metadata.availableAudioBitrates = ParseIntegerMatches(json, bitratePattern, 1, 5000, true);
    metadata.thumbnailUrl = ParseThumbnailUrl(json);

    AppendWideLogLine(
        L"Metadata fetch completed. Resolutions: " + std::to_wstring(metadata.availableResolutions.size()) +
        L", FPS: " + std::to_wstring(metadata.availableFps.size()) +
        L", Bitrates: " + std::to_wstring(metadata.availableAudioBitrates.size())
    );
    return true;
}

void CancelActiveYtDlpDownload() {
    HANDLE processToTerminate = nullptr;
    {
        std::lock_guard<std::mutex> lock(gDownloadStateMutex);
        gDownloadCancellationRequested = true;
        processToTerminate = gActiveDownloadProcess;
    }

    if (processToTerminate != nullptr) {
        TerminateProcess(processToTerminate, 1);
    }
}

void RunYtDlpThumbnailDownload(
    const std::wstring& url,
    const std::wstring& path,
    const std::wstring& browserForCookies,
    ICoreWebView2* webviewPtr
) {
    AppendWideLogLine(L"------------------------------------------------------------");
    AppendWideLogLine(L"Thumbnail download started");
    AppendWideLogLine(L"URL: " + url);
    AppendWideLogLine(L"Target directory: " + path);
    AppendWideLogLine(L"Cookie browser: " + browserForCookies);

    const std::wstring ytDlpPath = ResolveYtDlpExecutable();
    if (ytDlpPath.empty()) {
        AppendWideLogLine(L"yt-dlp executable not found.");
        PostStatus(webviewPtr, L"thumbnail:error");
        return;
    }

    const std::wstring outputPath = path + L"\\%(title)s.%(ext)s";
    const std::wstring commandLine = BuildThumbnailCommand(
        ytDlpPath,
        url,
        outputPath,
        browserForCookies,
        true
    );

    int lastProgress = 0;
    bool completed = ExecuteYtDlpCommand(commandLine, nullptr, lastProgress);

    const bool hasSelectedCookieBrowser = !NormalizeCookieBrowser(browserForCookies).empty();
    if (!completed && hasSelectedCookieBrowser) {
        AppendWideLogLine(L"Thumbnail command failed with browser cookies. Retrying without cookies.");

        const std::wstring fallbackCommandLine = BuildThumbnailCommand(
            ytDlpPath,
            url,
            outputPath,
            browserForCookies,
            false
        );

        completed = ExecuteYtDlpCommand(fallbackCommandLine, nullptr, lastProgress);
    }

    if (completed) {
        AppendWideLogLine(L"Thumbnail download finished successfully.");
        PostStatus(webviewPtr, L"thumbnail:done");
    }
    else {
        AppendWideLogLine(L"Thumbnail download failed.");
        PostStatus(webviewPtr, L"thumbnail:error");
    }
}

std::wstring GetDownloadLogFilePath() {
    return GetDownloadLogFilePathInternal();
}

bool OpenDownloadLogInDefaultEditor() {
    const std::wstring logDirectory = GetLogDirectoryPath();
    const std::wstring logFilePath = GetDownloadLogFilePathInternal();
    EnsureLogDirectoryExists(logDirectory);
    EnsureLogFileExists(logFilePath);

    const HINSTANCE openResult = ShellExecuteW(
        nullptr,
        L"open",
        logFilePath.c_str(),
        nullptr,
        nullptr,
        SW_SHOWNORMAL
    );
    return reinterpret_cast<intptr_t>(openResult) > 32;
}
