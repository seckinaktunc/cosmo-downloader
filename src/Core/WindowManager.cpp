#include "WindowManager.h"
#include "WindowProc.h"

#include <tchar.h>
#include <dwmapi.h>
#include "resource.h"

void ResizeAndCenterWindow(HWND hWnd, int clientWidth, int clientHeight) {
    if (!IsWindow(hWnd) || clientWidth <= 0 || clientHeight <= 0) {
        return;
    }

    RECT windowRect = { 0, 0, clientWidth, clientHeight };
    const DWORD style = static_cast<DWORD>(GetWindowLongPtr(hWnd, GWL_STYLE));
    const DWORD exStyle = static_cast<DWORD>(GetWindowLongPtr(hWnd, GWL_EXSTYLE));
    AdjustWindowRectEx(&windowRect, style, FALSE, exStyle);

    const int windowWidth = windowRect.right - windowRect.left;
    const int windowHeight = windowRect.bottom - windowRect.top;

    RECT workArea = { 0, 0, GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN) };
    MONITORINFO monitorInfo = { sizeof(MONITORINFO) };
    const HMONITOR monitor = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
    if (GetMonitorInfo(monitor, &monitorInfo)) {
        workArea = monitorInfo.rcWork;
    }

    const int x = workArea.left + ((workArea.right - workArea.left) - windowWidth) / 2;
    const int y = workArea.top + ((workArea.bottom - workArea.top) - windowHeight) / 2;

    SetWindowPos(hWnd, NULL, x, y, windowWidth, windowHeight, SWP_NOZORDER | SWP_NOACTIVATE);
}

HWND InitWindow(HINSTANCE hInstance, int nCmdShow) {
    WNDCLASSEX wcex = { sizeof(WNDCLASSEX) };
    wcex.style = CS_HREDRAW | CS_VREDRAW;
    wcex.lpfnWndProc = MainWindowProc;
    wcex.hInstance = hInstance;
    wcex.hCursor = LoadCursor(NULL, IDC_ARROW);
    wcex.lpszClassName = _T("WebView2Win32App");
    wcex.hbrBackground = (HBRUSH)GetStockObject(NULL_BRUSH);

    // Icon
    wcex.hIcon = LoadIcon(hInstance, MAKEINTRESOURCE(IDI_MAIN_ICON));
    wcex.hIconSm = LoadIcon(hInstance, MAKEINTRESOURCE(IDI_MAIN_ICON));

    RegisterClassEx(&wcex);

    // Default client size
    constexpr int initialClientWidth = 800;
    constexpr int initialClientHeight = 600;

    DWORD dwStyle = WS_POPUP | WS_MINIMIZEBOX | WS_SYSMENU;
    HWND hWnd = CreateWindowEx(
        0,
        _T("WebView2Win32App"), _T("Cosmo Downloader"),
        dwStyle,
        0, 0, initialClientWidth, initialClientHeight,
        NULL, NULL, hInstance, NULL
    );

    if (hWnd) {
        MARGINS margins = { -1 };
        DwmExtendFrameIntoClientArea(hWnd, &margins);
        ResizeAndCenterWindow(hWnd, initialClientWidth, initialClientHeight);

        // Force icon
        SendMessage(hWnd, WM_SETICON, ICON_BIG, (LPARAM)wcex.hIcon);
        SendMessage(hWnd, WM_SETICON, ICON_SMALL, (LPARAM)wcex.hIconSm);
    }

    return hWnd;
}