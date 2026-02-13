#include "WebViewManager.h"
#include "WebMessageHandler.h"

#include <string>
#include <wil/com.h>

using namespace Microsoft::WRL;

WebViewManager& WebViewManager::GetInstance() {
    static WebViewManager instance;
    return instance;
}

ICoreWebView2* WebViewManager::GetWebView() {
    return webview.get();
}

void WebViewManager::Resize(HWND hWnd) {
    if (webviewController != nullptr) {
        RECT bounds;
        GetClientRect(hWnd, &bounds);
        webviewController->put_Bounds(bounds);
    }
}

void WebViewManager::Initialize(HWND hWnd) {
    hasCenteredOnFirstResize = false;

    CreateCoreWebView2EnvironmentWithOptions(nullptr, nullptr, nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [hWnd, this](HRESULT result, ICoreWebView2Environment* env) -> HRESULT {
                if (FAILED(result)) {
                    ShowWindow(hWnd, SW_SHOW);
                    MessageBox(hWnd, L"WebView2 Environment oluşturulamadı!", L"Hata", MB_OK | MB_ICONERROR);
                    return result;
                }

                env->CreateCoreWebView2Controller(hWnd, Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                    [hWnd, this](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT {
                        if (controller != nullptr) {
                            webviewController = controller;
                            webviewController->get_CoreWebView2(&webview);
                            webviewController->put_IsVisible(TRUE);

                            // Message Handler
                            webview->add_WebMessageReceived(Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                                [hWnd, this](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
                                    wil::unique_cotaskmem_string message;
                                    if (FAILED(args->TryGetWebMessageAsString(&message))) {
                                        return S_OK;
                                    }

                                    const std::wstring webMessage = message ? message.get() : L"";
                                    HandleWebMessage(hWnd, webMessage, webview.get(), hasCenteredOnFirstResize);

                                    return S_OK;
                                }).Get(), nullptr);

                            webview->add_NavigationCompleted(Callback<ICoreWebView2NavigationCompletedEventHandler>(
                                [hWnd](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs* args) -> HRESULT {
                                    BOOL isSuccess;
                                    args->get_IsSuccess(&isSuccess);
                                    if (!isSuccess) {
                                        ShowWindow(hWnd, SW_SHOW);
                                    }
                                    return S_OK;
                                }).Get(), nullptr);

                            // Transparency setting
                            wil::com_ptr<ICoreWebView2Controller2> controller2;
                            if (SUCCEEDED(webviewController->QueryInterface(IID_PPV_ARGS(&controller2)))) {
                                COREWEBVIEW2_COLOR transparentColor = { 0, 0, 0, 0 };
                                controller2->put_DefaultBackgroundColor(transparentColor);
                            }

                            Resize(hWnd);
                            webview->Navigate(L"http://localhost:5173");
                        }
                        else {
                            ShowWindow(hWnd, SW_SHOW);
                        }
                        return S_OK;
                    }).Get());
                return S_OK;
            }).Get());
}

void WebViewManager::PostMessageToWeb(const std::wstring& message) {
    if (webview) {
        webview->PostWebMessageAsString(message.c_str());
    }
}
