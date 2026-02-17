#include "WindowProc.h"

#include "WebView/WebViewManager.h"
#include "Utils/Clipboard.h"

LRESULT CALLBACK MainWindowProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam) {
    switch (message) {
    case WM_ERASEBKGND:
        return 1;
    case WM_SYSCOMMAND:
        if ((wParam & 0xFFF0) == SC_MINIMIZE) {
            WebViewManager::GetInstance().PostMessageToWeb(L"request_minimize");
            return 0;
        }
        break;
    case WM_SIZE:
        WebViewManager::GetInstance().Resize(hWnd);
        if (wParam == SIZE_RESTORED) {
            WebViewManager::GetInstance().PostMessageToWeb(L"window_restored");
        }
        break;
    case WM_CLIPBOARDUPDATE:
        WebViewManager::GetInstance().PostMessageToWeb(L"clipboard_updated:" + GetClipboardText());
        return 0;
    case WM_DESTROY:
        RemoveClipboardFormatListener(hWnd);
        PostQuitMessage(0);
        break;
    default:
        return DefWindowProc(hWnd, message, wParam, lParam);
    }

    return DefWindowProc(hWnd, message, wParam, lParam);
}
