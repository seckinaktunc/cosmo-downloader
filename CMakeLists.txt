cmake_minimum_required(VERSION 3.20)

# Activate RC
project(CosmoDownloader LANGUAGES CXX RC)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Packages
find_package(wil CONFIG REQUIRED)
find_package(unofficial-webview2 CONFIG REQUIRED)

# Resources
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
    res/app.rc
    res/resource.h
)
set_source_files_properties(res/app.rc PROPERTIES LANGUAGE RC)

# Executable
add_executable(CosmoDownloader WIN32 ${SOURCES})

# Include
target_include_directories(CosmoDownloader PRIVATE 
    src
    res              # <--- EKLENDİ
)

target_compile_definitions(CosmoDownloader PRIVATE UNICODE _UNICODE)

# Link
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

# Copy DLL
add_custom_command(TARGET CosmoDownloader POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
    $<TARGET_FILE:unofficial::webview2::webview2>
    $<TARGET_FILE_DIR:CosmoDownloader>
    COMMENT "WebView2Loader.dll kopyalaniyor..."
)

# Copy yt-dlp
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