#pragma once
#include <windows.h>

HWND InitWindow(HINSTANCE hInstance, int nCmdShow);
void ResizeAndCenterWindow(HWND hWnd, int clientWidth, int clientHeight);