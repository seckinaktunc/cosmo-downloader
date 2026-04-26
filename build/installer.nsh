!include "LogicLib.nsh"
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

Var InstallerExecutablePath
Var InstallerOldShortcutName
Var InstallerOldMenuDirectory
Var InstallerOldDesktopLink
Var InstallerNewDesktopLink
Var InstallerOldStartMenuLink
Var InstallerNewStartMenuLink
!ifndef BUILD_UNINSTALLER
  Var ShortcutPage
  Var DesktopShortcutCheckbox
  Var StartMenuShortcutCheckbox
  Var ShouldCreateDesktopShortcut
  Var ShouldCreateStartMenuShortcut
!endif

!ifndef BUILD_UNINSTALLER
  Function SetShortcutPaths
    StrCpy $InstallerExecutablePath "$INSTDIR\${PRODUCT_FILENAME}.exe"

    ReadRegStr $InstallerOldShortcutName SHELL_CONTEXT "Software\${APP_GUID}" ShortcutName
    ${If} $InstallerOldShortcutName == ""
      StrCpy $InstallerOldShortcutName "${PRODUCT_FILENAME}"
    ${EndIf}

    StrCpy $InstallerOldDesktopLink "$DESKTOP\$InstallerOldShortcutName.lnk"
    StrCpy $InstallerNewDesktopLink "$DESKTOP\${SHORTCUT_NAME}.lnk"

    ReadRegStr $InstallerOldMenuDirectory SHELL_CONTEXT "Software\${APP_GUID}" MenuDirectory
    ${If} $InstallerOldMenuDirectory == ""
      StrCpy $InstallerOldStartMenuLink "$SMPROGRAMS\$InstallerOldShortcutName.lnk"
    ${Else}
      StrCpy $InstallerOldStartMenuLink "$SMPROGRAMS\$InstallerOldMenuDirectory\$InstallerOldShortcutName.lnk"
    ${EndIf}

    !ifdef MENU_FILENAME
      StrCpy $InstallerNewStartMenuLink "$SMPROGRAMS\${MENU_FILENAME}\${SHORTCUT_NAME}.lnk"
    !else
      StrCpy $InstallerNewStartMenuLink "$SMPROGRAMS\${SHORTCUT_NAME}.lnk"
    !endif
  FunctionEnd

  Function ShortcutPageCreate
    !insertmacro MUI_HEADER_TEXT "Shortcut Options" "Choose which shortcuts to create."

    nsDialogs::Create 1018
    Pop $ShortcutPage
    ${If} $ShortcutPage == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0u 0u 300u 18u "Select which shortcuts the installer should create."
    Pop $0

    ${NSD_CreateCheckbox} 0u 30u 300u 14u "Create a Desktop shortcut"
    Pop $DesktopShortcutCheckbox
    ${NSD_Check} $DesktopShortcutCheckbox

    ${NSD_CreateCheckbox} 0u 52u 300u 14u "Create a Start Menu shortcut"
    Pop $StartMenuShortcutCheckbox
    ${NSD_Check} $StartMenuShortcutCheckbox

    nsDialogs::Show
  FunctionEnd

  Function ShortcutPageLeave
    ${NSD_GetState} $DesktopShortcutCheckbox $ShouldCreateDesktopShortcut
    ${NSD_GetState} $StartMenuShortcutCheckbox $ShouldCreateStartMenuShortcut
  FunctionEnd
!else
  Function un.SetShortcutPaths
    StrCpy $InstallerExecutablePath "$INSTDIR\${PRODUCT_FILENAME}.exe"

    ReadRegStr $InstallerOldShortcutName SHELL_CONTEXT "Software\${APP_GUID}" ShortcutName
    ${If} $InstallerOldShortcutName == ""
      StrCpy $InstallerOldShortcutName "${PRODUCT_FILENAME}"
    ${EndIf}

    StrCpy $InstallerOldDesktopLink "$DESKTOP\$InstallerOldShortcutName.lnk"
    StrCpy $InstallerNewDesktopLink "$DESKTOP\${SHORTCUT_NAME}.lnk"

    ReadRegStr $InstallerOldMenuDirectory SHELL_CONTEXT "Software\${APP_GUID}" MenuDirectory
    ${If} $InstallerOldMenuDirectory == ""
      StrCpy $InstallerOldStartMenuLink "$SMPROGRAMS\$InstallerOldShortcutName.lnk"
    ${Else}
      StrCpy $InstallerOldStartMenuLink "$SMPROGRAMS\$InstallerOldMenuDirectory\$InstallerOldShortcutName.lnk"
    ${EndIf}

    !ifdef MENU_FILENAME
      StrCpy $InstallerNewStartMenuLink "$SMPROGRAMS\${MENU_FILENAME}\${SHORTCUT_NAME}.lnk"
    !else
      StrCpy $InstallerNewStartMenuLink "$SMPROGRAMS\${SHORTCUT_NAME}.lnk"
    !endif
  FunctionEnd
!endif

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customInit
  StrCpy $ShouldCreateDesktopShortcut ${BST_CHECKED}
  StrCpy $ShouldCreateStartMenuShortcut ${BST_CHECKED}
  Call SetShortcutPaths
!macroend

!macro customUnInit
  Call un.SetShortcutPaths
!macroend

!macro customPageAfterChangeDir
  PageEx custom
    PageCallbacks ShortcutPageCreate ShortcutPageLeave
    Caption " "
  PageExEnd
!macroend

!macro customInstall
  ${If} $ShouldCreateDesktopShortcut == ${BST_CHECKED}
    CreateShortCut "$InstallerNewDesktopLink" "$InstallerExecutablePath" "" "$InstallerExecutablePath" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$InstallerNewDesktopLink" "${APP_ID}"
    ${If} $InstallerOldDesktopLink != $InstallerNewDesktopLink
      WinShell::UninstShortcut "$InstallerOldDesktopLink"
      Delete "$InstallerOldDesktopLink"
    ${EndIf}
  ${Else}
    WinShell::UninstShortcut "$InstallerOldDesktopLink"
    Delete "$InstallerOldDesktopLink"
    ${If} $InstallerOldDesktopLink != $InstallerNewDesktopLink
      WinShell::UninstShortcut "$InstallerNewDesktopLink"
      Delete "$InstallerNewDesktopLink"
    ${EndIf}
  ${EndIf}

  ${If} $ShouldCreateStartMenuShortcut == ${BST_CHECKED}
    !ifdef MENU_FILENAME
      CreateDirectory "$SMPROGRAMS\${MENU_FILENAME}"
      ClearErrors
    !endif
    CreateShortCut "$InstallerNewStartMenuLink" "$InstallerExecutablePath" "" "$InstallerExecutablePath" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$InstallerNewStartMenuLink" "${APP_ID}"
    ${If} $InstallerOldStartMenuLink != $InstallerNewStartMenuLink
      WinShell::UninstShortcut "$InstallerOldStartMenuLink"
      Delete "$InstallerOldStartMenuLink"
    ${EndIf}
    ${IfNot} $InstallerOldMenuDirectory == ""
      !ifdef MENU_FILENAME
        ${If} $InstallerOldMenuDirectory != "${MENU_FILENAME}"
          RMDir "$SMPROGRAMS\$InstallerOldMenuDirectory"
        ${EndIf}
      !else
        RMDir "$SMPROGRAMS\$InstallerOldMenuDirectory"
      !endif
    ${EndIf}
  ${Else}
    WinShell::UninstShortcut "$InstallerOldStartMenuLink"
    Delete "$InstallerOldStartMenuLink"
    ${If} $InstallerOldStartMenuLink != $InstallerNewStartMenuLink
      WinShell::UninstShortcut "$InstallerNewStartMenuLink"
      Delete "$InstallerNewStartMenuLink"
    ${EndIf}
    !ifdef MENU_FILENAME
      RMDir "$SMPROGRAMS\${MENU_FILENAME}"
    !endif
    ${IfNot} $InstallerOldMenuDirectory == ""
      RMDir "$SMPROGRAMS\$InstallerOldMenuDirectory"
    ${EndIf}
  ${EndIf}

  System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend

!macro customUnInstall
  WinShell::UninstShortcut "$InstallerOldDesktopLink"
  Delete "$InstallerOldDesktopLink"
  ${If} $InstallerOldDesktopLink != $InstallerNewDesktopLink
    WinShell::UninstShortcut "$InstallerNewDesktopLink"
    Delete "$InstallerNewDesktopLink"
  ${EndIf}

  WinShell::UninstShortcut "$InstallerOldStartMenuLink"
  Delete "$InstallerOldStartMenuLink"
  ${If} $InstallerOldStartMenuLink != $InstallerNewStartMenuLink
    WinShell::UninstShortcut "$InstallerNewStartMenuLink"
    Delete "$InstallerNewStartMenuLink"
  ${EndIf}

  !ifdef MENU_FILENAME
    RMDir "$SMPROGRAMS\${MENU_FILENAME}"
  !endif
  ${IfNot} $InstallerOldMenuDirectory == ""
    RMDir "$SMPROGRAMS\$InstallerOldMenuDirectory"
  ${EndIf}

  System::Call 'shell32::SHChangeNotify(i, i, i, i) v (0x08000000, 0, 0, 0)'
!macroend
