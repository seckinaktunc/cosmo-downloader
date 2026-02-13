cmake_minimum_required(VERSION 3.20)

# RC dilini etkinleştiriyoruz ki .rc dosyası derlenip ikon eklensin
project(CosmoDownloader LANGUAGES CXX RC)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# --- 1. PAKETLERİ BUL ---
find_package(wil CONFIG REQUIRED)
find_package(unofficial-webview2 CONFIG REQUIRED)

# --- 2. KAYNAK DOSYALAR ---
# app.rc ve resource.h dosyalarını buraya ekliyoruz
set(SOURCES
    src/App/Application.cpp
    src/Main.cpp
    src/Core/WindowManager.cpp
    src/Core/WindowProc.cpp
    src/WebView/WebViewManager.cpp
    src/WebView/WebMessageHandler.cpp
    src/Utils/FolderDialog.cpp
    src/Utils/NotificationService.cpp
    src/Utils/YtDlpRunner.cpp
    res/app.rc       # <--- EKLENDİ (İkon kaynağı)
    res/resource.h   # <--- EKLENDİ (Header dosyası)
)
set_source_files_properties(res/app.rc PROPERTIES LANGUAGE RC)

# --- 3. EXECUTABLE ---
add_executable(CosmoDownloader WIN32 ${SOURCES})

# --- 4. INCLUDE ---
# "res" klasörünü ekliyoruz ki Main.cpp içinde #include "resource.h" diyebilelim
target_include_directories(CosmoDownloader PRIVATE 
    src
    res              # <--- EKLENDİ
)

# --- 4.1 WIDE CHAR ---
target_compile_definitions(CosmoDownloader PRIVATE UNICODE _UNICODE)

# --- 5. BAĞLAMALAR (LINKING) ---
target_link_libraries(CosmoDownloader PRIVATE
    WIL::WIL                        
    unofficial::webview2::webview2  
    dwmapi
    shlwapi
    user32
    shell32
    ole32
    oleaut32
)

# --- 6. DLL KOPYALAMA ---
add_custom_command(TARGET CosmoDownloader POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
    $<TARGET_FILE:unofficial::webview2::webview2>
    $<TARGET_FILE_DIR:CosmoDownloader>
    COMMENT "WebView2Loader.dll kopyalaniyor..."
)

# --- 7. yt-dlp KOPYALAMA (opsiyonel) ---
set(YT_DLP_SOURCE "${CMAKE_CURRENT_SOURCE_DIR}/res/yt-dlp.exe")
if (EXISTS "${YT_DLP_SOURCE}")
    add_custom_command(TARGET CosmoDownloader POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${YT_DLP_SOURCE}"
        $<TARGET_FILE_DIR:CosmoDownloader>
        COMMENT "yt-dlp.exe kopyalaniyor..."
    )
else()
    message(STATUS "yt-dlp.exe bulunamadi: ${YT_DLP_SOURCE}. PATH'ten bulunacak.")
endif()
