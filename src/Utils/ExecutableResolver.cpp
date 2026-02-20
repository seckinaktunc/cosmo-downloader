#include "ExecutableResolver.h"

#include <array>
#include <windows.h>

std::wstring GetExecutableDirectoryPath() {
    std::array<wchar_t, MAX_PATH> modulePath = {};
    const DWORD length = GetModuleFileNameW(
        nullptr,
        modulePath.data(),
        static_cast<DWORD>(modulePath.size())
    );
    if (length == 0 || length == modulePath.size()) {
        return L"";
    }

    std::wstring path(modulePath.data(), length);
    const size_t lastSlash = path.find_last_of(L"\\/");
    if (lastSlash != std::wstring::npos) {
        path.erase(lastSlash);
    }

    return path;
}

std::wstring ResolveBundledOrSystemExecutable(const std::wstring& executableName) {
    if (executableName.empty()) {
        return L"";
    }

    const std::wstring executableDirectory = GetExecutableDirectoryPath();
    if (!executableDirectory.empty()) {
        const std::wstring localCopy = executableDirectory + L"\\" + executableName;
        if (GetFileAttributesW(localCopy.c_str()) != INVALID_FILE_ATTRIBUTES) {
            return localCopy;
        }
    }

    std::array<wchar_t, MAX_PATH> foundPath = {};
    const DWORD result = SearchPathW(
        nullptr,
        executableName.c_str(),
        nullptr,
        static_cast<DWORD>(foundPath.size()),
        foundPath.data(),
        nullptr
    );
    if (result > 0 && result < foundPath.size()) {
        return std::wstring(foundPath.data());
    }

    return L"";
}
