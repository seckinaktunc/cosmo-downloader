#include "SystemSettings.h"

#include <d3d11.h>
#include <knownfolders.h>
#include <shlobj.h>
#include <wil/com.h>

bool IsHardwareAccelerationSupported() {
    wil::com_ptr<ID3D11Device> device;
    wil::com_ptr<ID3D11DeviceContext> context;

    const HRESULT result = D3D11CreateDevice(
        nullptr,
        D3D_DRIVER_TYPE_HARDWARE,
        nullptr,
        0,
        nullptr,
        0,
        D3D11_SDK_VERSION,
        device.put(),
        nullptr,
        context.put()
    );

    return SUCCEEDED(result);
}

std::wstring GetDefaultDownloadDirectory() {
    PWSTR rawPath = nullptr;
    const HRESULT result = SHGetKnownFolderPath(
        FOLDERID_Downloads,
        KF_FLAG_DEFAULT,
        nullptr,
        &rawPath
    );

    if (FAILED(result) || rawPath == nullptr) {
        return L"";
    }

    const std::wstring path(rawPath);
    CoTaskMemFree(rawPath);
    return path;
}
