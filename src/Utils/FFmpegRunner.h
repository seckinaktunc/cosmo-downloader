#pragma once

#include <string>
#include <vector>

struct FFmpegConversionRequest {
    std::wstring inputPath;
    std::wstring outputPath;
    std::wstring targetFormat;
    std::wstring videoCodec = L"auto";
    std::wstring audioCodec = L"auto";
    int audioBitrateKbps = 0;
    std::wstring hardwareAccelerationMode = L"none";
};

std::wstring ResolveFFmpegExecutable();
std::wstring ResolveFFprobeExecutable();

std::vector<std::wstring> GetAvailableFFmpegHardwareAccelerationOptions();
std::wstring NormalizeHardwareAccelerationMode(const std::wstring& requestedMode);

bool ConvertMediaWithFFmpeg(
    const FFmpegConversionRequest& request,
    std::wstring& errorMessage
);
