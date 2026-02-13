#include "FolderDialog.h"

#include <shobjidl.h>

std::wstring SelectFolder(HWND hWnd) {
    IFileDialog* fileDialog = nullptr;
    std::wstring path;

    if (SUCCEEDED(CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&fileDialog)))) {
        DWORD options = 0;
        fileDialog->GetOptions(&options);
        fileDialog->SetOptions(options | FOS_PICKFOLDERS);

        if (SUCCEEDED(fileDialog->Show(hWnd))) {
            IShellItem* shellItem = nullptr;
            if (SUCCEEDED(fileDialog->GetResult(&shellItem))) {
                PWSTR selectedPath = nullptr;
                if (SUCCEEDED(shellItem->GetDisplayName(SIGDN_FILESYSPATH, &selectedPath))) {
                    path = selectedPath;
                    CoTaskMemFree(selectedPath);
                }
                shellItem->Release();
            }
        }

        fileDialog->Release();
    }

    return path;
}
