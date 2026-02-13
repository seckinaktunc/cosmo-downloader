#include "Application.h"

#include "Core/WindowManager.h"
#include "WebView/WebViewManager.h"

namespace {
    class ComInitializer {
    public:
        bool Initialize() {
            const HRESULT result = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
            if (SUCCEEDED(result)) {
                initialized_ = true;
                return true;
            }

            return result == RPC_E_CHANGED_MODE;
        }

        ~ComInitializer() {
            if (initialized_) {
                CoUninitialize();
            }
        }

    private:
        bool initialized_ = false;
    };
}

int RunApplication(HINSTANCE hInstance, int nCmdShow) {
    ComInitializer comInitializer;
    if (!comInitializer.Initialize()) {
        return FALSE;
    }

    HWND hWnd = InitWindow(hInstance, nCmdShow);
    if (!hWnd) {
        return FALSE;
    }

    WebViewManager::GetInstance().Initialize(hWnd);

    MSG msg = {};
    while (GetMessage(&msg, nullptr, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    return static_cast<int>(msg.wParam);
}
