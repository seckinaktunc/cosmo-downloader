#include "BrowserDetector.h"

#include <array>
#include <string>
#include <vector>
#include <windows.h>

namespace {
    struct BrowserProbe {
        const wchar_t* key;
        std::vector<std::wstring> appPathExecutables;
        std::vector<std::wstring> pathExecutables;
        std::vector<std::wstring> markerRegistryKeys;
        std::vector<std::wstring> knownPaths;
    };

    bool TryOpenRegistryKey(HKEY root, const std::wstring& subKey, REGSAM accessMask) {
        HKEY keyHandle = nullptr;
        const LONG result = RegOpenKeyExW(root, subKey.c_str(), 0, accessMask, &keyHandle);
        if (result == ERROR_SUCCESS && keyHandle != nullptr) {
            RegCloseKey(keyHandle);
            return true;
        }

        return false;
    }

    bool RegistryKeyExists(HKEY root, const std::wstring& subKey) {
        static const std::array<REGSAM, 3> registryViews = {
            KEY_READ | KEY_WOW64_64KEY,
            KEY_READ | KEY_WOW64_32KEY,
            KEY_READ,
        };

        for (const REGSAM view : registryViews) {
            if (TryOpenRegistryKey(root, subKey, view)) {
                return true;
            }
        }

        return false;
    }

    bool IsInAppPaths(HKEY root, const std::wstring& executableName) {
        const std::wstring appPath = L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\" + executableName;
        return RegistryKeyExists(root, appPath);
    }

    bool IsExecutableInAppPaths(const std::wstring& executableName) {
        return IsInAppPaths(HKEY_CURRENT_USER, executableName) ||
            IsInAppPaths(HKEY_LOCAL_MACHINE, executableName);
    }

    bool FileExists(const std::wstring& path) {
        if (path.empty()) {
            return false;
        }

        const DWORD attributes = GetFileAttributesW(path.c_str());
        return attributes != INVALID_FILE_ATTRIBUTES && (attributes & FILE_ATTRIBUTE_DIRECTORY) == 0;
    }

    std::wstring ExpandEnvironmentPath(const std::wstring& rawPath) {
        if (rawPath.empty()) {
            return L"";
        }

        const DWORD requiredLength = ExpandEnvironmentStringsW(rawPath.c_str(), nullptr, 0);
        if (requiredLength == 0) {
            return L"";
        }

        std::wstring expanded(requiredLength, L'\0');
        const DWORD writtenLength = ExpandEnvironmentStringsW(rawPath.c_str(), expanded.data(), requiredLength);
        if (writtenLength == 0) {
            return L"";
        }

        if (!expanded.empty() && expanded.back() == L'\0') {
            expanded.pop_back();
        }

        return expanded;
    }

    bool AnyKnownPathExists(const std::vector<std::wstring>& knownPaths) {
        for (const std::wstring& rawPath : knownPaths) {
            const std::wstring expandedPath = ExpandEnvironmentPath(rawPath);
            if (FileExists(expandedPath)) {
                return true;
            }
        }

        return false;
    }

    bool AnyRegistryMarkerExists(const std::vector<std::wstring>& markerRegistryKeys) {
        for (const std::wstring& registryKey : markerRegistryKeys) {
            if (RegistryKeyExists(HKEY_CURRENT_USER, registryKey) ||
                RegistryKeyExists(HKEY_LOCAL_MACHINE, registryKey)) {
                return true;
            }
        }

        return false;
    }

    bool IsExecutableOnPath(const std::wstring& executableName) {
        wchar_t foundPath[MAX_PATH] = {};
        return SearchPathW(
            nullptr,
            executableName.c_str(),
            nullptr,
            static_cast<DWORD>(_countof(foundPath)),
            foundPath,
            nullptr
        ) > 0;
    }

    bool AnyAppPathExecutableExists(const std::vector<std::wstring>& executables) {
        for (const std::wstring& executable : executables) {
            if (IsExecutableInAppPaths(executable)) {
                return true;
            }
        }

        return false;
    }

    bool AnyPathExecutableExists(const std::vector<std::wstring>& executables) {
        for (const std::wstring& executable : executables) {
            if (IsExecutableOnPath(executable)) {
                return true;
            }
        }

        return false;
    }

    bool IsBrowserInstalled(const BrowserProbe& probe) {
        return AnyRegistryMarkerExists(probe.markerRegistryKeys) ||
            AnyAppPathExecutableExists(probe.appPathExecutables) ||
            AnyPathExecutableExists(probe.pathExecutables) ||
            AnyKnownPathExists(probe.knownPaths);
    }
}

std::vector<std::wstring> DetectInstalledBrowsers() {
    static const std::array<BrowserProbe, 9> browserProbes = {
        BrowserProbe{
            L"brave",
            {L"brave.exe"},
            {L"brave.exe"},
            {L"SOFTWARE\\BraveSoftware\\Brave-Browser"},
            {
                L"%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
                L"%ProgramFiles%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
                L"%ProgramFiles(x86)%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"
            }
        },
        BrowserProbe{
            L"chrome",
            {L"chrome.exe"},
            {L"chrome.exe"},
            {L"SOFTWARE\\Google\\Chrome"},
            {
                L"%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe",
                L"%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe",
                L"%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"
            }
        },
        BrowserProbe{
            L"chromium",
            {L"chromium.exe"},
            {L"chromium.exe"},
            {L"SOFTWARE\\Chromium"},
            {
                L"%LOCALAPPDATA%\\Chromium\\Application\\chrome.exe",
                L"%ProgramFiles%\\Chromium\\Application\\chrome.exe",
                L"%ProgramFiles(x86)%\\Chromium\\Application\\chrome.exe"
            }
        },
        BrowserProbe{
            L"edge",
            {L"msedge.exe"},
            {L"msedge.exe"},
            {L"SOFTWARE\\Microsoft\\Edge"},
            {
                L"%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe",
                L"%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"
            }
        },
        BrowserProbe{
            L"firefox",
            {L"firefox.exe"},
            {L"firefox.exe"},
            {L"SOFTWARE\\Mozilla\\Mozilla Firefox"},
            {
                L"%ProgramFiles%\\Mozilla Firefox\\firefox.exe",
                L"%ProgramFiles(x86)%\\Mozilla Firefox\\firefox.exe"
            }
        },
        BrowserProbe{
            L"opera",
            {L"opera.exe", L"launcher.exe"},
            {L"opera.exe"},
            {L"SOFTWARE\\Opera Software"},
            {
                L"%LOCALAPPDATA%\\Programs\\Opera\\launcher.exe",
                L"%ProgramFiles%\\Opera\\launcher.exe",
                L"%ProgramFiles(x86)%\\Opera\\launcher.exe"
            }
        },
        BrowserProbe{
            L"safari",
            {L"safari.exe"},
            {L"safari.exe"},
            {L"SOFTWARE\\Apple Computer, Inc.\\Safari"},
            {
                L"%ProgramFiles%\\Safari\\Safari.exe",
                L"%ProgramFiles(x86)%\\Safari\\Safari.exe"
            }
        },
        BrowserProbe{
            L"vivaldi",
            {L"vivaldi.exe"},
            {L"vivaldi.exe"},
            {L"SOFTWARE\\Vivaldi"},
            {
                L"%LOCALAPPDATA%\\Vivaldi\\Application\\vivaldi.exe",
                L"%ProgramFiles%\\Vivaldi\\Application\\vivaldi.exe",
                L"%ProgramFiles(x86)%\\Vivaldi\\Application\\vivaldi.exe"
            }
        },
        BrowserProbe{
            L"whale",
            {L"whale.exe"},
            {L"whale.exe"},
            {L"SOFTWARE\\Naver\\Naver Whale"},
            {
                L"%LOCALAPPDATA%\\Naver\\Naver Whale\\Application\\whale.exe",
                L"%ProgramFiles%\\Naver\\Naver Whale\\Application\\whale.exe",
                L"%ProgramFiles(x86)%\\Naver\\Naver Whale\\Application\\whale.exe"
            }
        }
    };

    std::vector<std::wstring> installedBrowsers;
    installedBrowsers.reserve(browserProbes.size());

    for (const BrowserProbe& probe : browserProbes) {
        if (IsBrowserInstalled(probe)) {
            installedBrowsers.emplace_back(probe.key);
        }
    }

    return installedBrowsers;
}
