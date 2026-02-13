#pragma once

#include <string>
#include <windows.h>

void SendNativeNotification(HWND hWnd, const std::wstring& title, const std::wstring& message);
