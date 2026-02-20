#pragma once

#include <string>

std::wstring GetExecutableDirectoryPath();
std::wstring ResolveBundledOrSystemExecutable(const std::wstring& executableName);
