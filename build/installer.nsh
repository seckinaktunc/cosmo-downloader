!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "Sections.nsh"
!include "WinMessages.nsh"

!define /ifndef INSTALL_REGISTRY_KEY "Software\${APP_GUID}"
!define UN_CLEAN_CURRENT_PROFILE_LABEL "Remove app data, logs, caches, updater files, and temp remnants"
!define UN_CLEAN_ALL_PROFILES_LABEL "Also remove matching app data from other Windows user profiles"
!define UN_CLEAN_ALL_PROFILES_DISABLED_LABEL "Also remove matching app data from other Windows user profiles (requires all-users uninstall)"

Var InstallerExecutablePath
Var InstallerOldShortcutName
Var InstallerOldMenuDirectory
Var InstallerOldDesktopLink
Var InstallerNewDesktopLink
Var InstallerOldStartMenuLink
Var InstallerNewStartMenuLink

!ifdef BUILD_UNINSTALLER
  Var UnCleanupCurrentSectionIndex
  Var UnCleanupAllProfilesSectionIndex
  Var UnCleanupSectionsResolved
  Var UnDeleteCurrentProfileData
  Var UnDeleteAllProfilesData
  Var UnIsAllUsersContext
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.ConfigureCleanupComponentsPage
!endif

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

    Call SetShortcutPaths

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
  ; Keep the install mode page enabled so users can choose per-user or all-users.
!macroend

!macro customInit
  StrCpy $ShouldCreateDesktopShortcut ${BST_CHECKED}
  StrCpy $ShouldCreateStartMenuShortcut ${BST_CHECKED}
  Call SetShortcutPaths
!macroend

!macro customUnInit
  Call un.SetShortcutPaths
  StrCpy $UnCleanupCurrentSectionIndex ""
  StrCpy $UnCleanupAllProfilesSectionIndex ""
  StrCpy $UnCleanupSectionsResolved "0"
  StrCpy $UnDeleteCurrentProfileData "0"
  StrCpy $UnDeleteAllProfilesData "0"
  StrCpy $UnIsAllUsersContext "0"
  Call un.ParseCleanupCommandLine
  Call un.ConfigureCleanupSections
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

!ifdef BUILD_UNINSTALLER
Function un.ResolveCleanupSectionIndexes
  ${If} $UnCleanupSectionsResolved == "1"
    Return
  ${EndIf}

  Push $0
  Push $1

  StrCpy $0 0

  section_loop:
    IntCmp $0 256 section_done

    SectionGetText $0 $1
    StrCmp $1 "${UN_CLEAN_CURRENT_PROFILE_LABEL}" found_current
    StrCmp $1 "un.${UN_CLEAN_CURRENT_PROFILE_LABEL}" found_current
    StrCmp $1 "${UN_CLEAN_ALL_PROFILES_LABEL}" found_all
    StrCmp $1 "un.${UN_CLEAN_ALL_PROFILES_LABEL}" found_all
    StrCmp $1 "${UN_CLEAN_ALL_PROFILES_DISABLED_LABEL}" found_all
    StrCmp $1 "un.${UN_CLEAN_ALL_PROFILES_DISABLED_LABEL}" found_all
    Goto next_section

  found_current:
    StrCpy $UnCleanupCurrentSectionIndex $0
    Goto next_section

  found_all:
    StrCpy $UnCleanupAllProfilesSectionIndex $0

  next_section:
    IntOp $0 $0 + 1
    Goto section_loop

  section_done:
    StrCpy $UnCleanupSectionsResolved "1"

    Pop $1
    Pop $0
FunctionEnd

Function un.ParseCleanupCommandLine
  Push $0
  Push $1

  ${GetParameters} $0

  ClearErrors
  ${GetOptions} $0 "--delete-app-data" $1
  ${IfNot} ${Errors}
    StrCpy $UnDeleteCurrentProfileData "1"
  ${EndIf}

  ClearErrors
  ${GetOptions} $0 "--delete-app-data-all-users" $1
  ${IfNot} ${Errors}
    StrCpy $UnDeleteCurrentProfileData "1"
    StrCpy $UnDeleteAllProfilesData "1"
  ${EndIf}

  Pop $1
  Pop $0
FunctionEnd

Function un.IsAllUsersContext
  Push $UnIsAllUsersContext
FunctionEnd

Function un.UpdateAllUsersContext
  Push $0
  Push $1

  StrCpy $UnIsAllUsersContext "0"

  ReadRegStr $0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" InstallLocation
  ReadRegStr $1 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation

  ${If} $0 != ""
  ${AndIf} $1 != ""
  ${AndIf} $0 == $1
    StrCpy $UnIsAllUsersContext "1"
  ${EndIf}

  Pop $1
  Pop $0
FunctionEnd

Function un.ConfigureCleanupSections
  Push $0
  Push $1

  Call un.ResolveCleanupSectionIndexes
  Call un.UpdateAllUsersContext
  Call un.IsAllUsersContext
  Pop $1

  ${If} $UnCleanupCurrentSectionIndex != ""
    SectionSetText $UnCleanupCurrentSectionIndex "${UN_CLEAN_CURRENT_PROFILE_LABEL}"

    ${If} $UnDeleteCurrentProfileData == "1"
      SectionSetFlags $UnCleanupCurrentSectionIndex ${SF_SELECTED}
    ${ElseIf} $UnDeleteAllProfilesData == "1"
    ${AndIf} $1 == "1"
      SectionSetFlags $UnCleanupCurrentSectionIndex ${SF_SELECTED}
    ${Else}
      SectionSetFlags $UnCleanupCurrentSectionIndex 0
    ${EndIf}
  ${EndIf}

  ${If} $UnCleanupAllProfilesSectionIndex == ""
    Goto cleanup_sections_done
  ${EndIf}

  ${If} $1 != "1"
    SectionSetText $UnCleanupAllProfilesSectionIndex "${UN_CLEAN_ALL_PROFILES_DISABLED_LABEL}"
    SectionSetFlags $UnCleanupAllProfilesSectionIndex ${SF_RO}
    StrCpy $UnDeleteAllProfilesData "0"
    Goto cleanup_sections_done
  ${EndIf}

  SectionSetText $UnCleanupAllProfilesSectionIndex "${UN_CLEAN_ALL_PROFILES_LABEL}"
  ${If} $UnDeleteAllProfilesData == "1"
    SectionSetFlags $UnCleanupAllProfilesSectionIndex ${SF_SELECTED}
    ${If} $UnCleanupCurrentSectionIndex != ""
      SectionSetFlags $UnCleanupCurrentSectionIndex ${SF_SELECTED}
    ${EndIf}
  ${Else}
    SectionSetFlags $UnCleanupAllProfilesSectionIndex 0
  ${EndIf}

  cleanup_sections_done:
    Pop $1
    Pop $0
FunctionEnd

Function un.ConfigureCleanupComponentsPage
  Call un.ConfigureCleanupSections
FunctionEnd

Function un.onSelChange
  Push $0

  Call un.ResolveCleanupSectionIndexes

  ${If} $UnCleanupAllProfilesSectionIndex == ""
    Goto cleanup_selection_done
  ${EndIf}

  SectionGetFlags $UnCleanupAllProfilesSectionIndex $0
  IntOp $0 $0 & ${SF_SELECTED}

  ${If} $0 == ${SF_SELECTED}
  ${AndIf} $UnCleanupCurrentSectionIndex != ""
    SectionSetFlags $UnCleanupCurrentSectionIndex ${SF_SELECTED}
  ${EndIf}

  cleanup_selection_done:
    Pop $0
FunctionEnd

Function un.RemoveDirectoryBestEffort
  Exch $0

  IfFileExists "$0" 0 missing_path

  DetailPrint "Removing $0"
  ClearErrors
  RMDir /r "$0"
  IfErrors locked_path
  Goto cleanup_done

  missing_path:
    DetailPrint "Skipping missing path: $0"
    Goto cleanup_done

  locked_path:
    ClearErrors
    DetailPrint "Skipping locked or inaccessible path: $0"

  cleanup_done:
    Pop $0
FunctionEnd

Function un.RemoveCurrentProfileArtifacts
  Call un.IsAllUsersContext
  Pop $0
  ${If} $0 == "1"
    SetShellVarContext current
  ${EndIf}

  Push "$APPDATA\${APP_FILENAME}"
  Call un.RemoveDirectoryBestEffort

  !ifdef APP_PRODUCT_FILENAME
    Push "$APPDATA\${APP_PRODUCT_FILENAME}"
    Call un.RemoveDirectoryBestEffort
  !endif

  !ifdef APP_PACKAGE_NAME
    Push "$APPDATA\${APP_PACKAGE_NAME}"
    Call un.RemoveDirectoryBestEffort

    Push "$LOCALAPPDATA\${APP_PACKAGE_NAME}-updater"
    Call un.RemoveDirectoryBestEffort

    Push "$TEMP\${APP_PACKAGE_NAME}"
    Call un.RemoveDirectoryBestEffort
  !endif

  ${If} $0 == "1"
    SetShellVarContext all
  ${EndIf}
FunctionEnd

Function un.RemoveProfileArtifacts
  Exch $0
  Push $1

  StrCpy $1 "$0\AppData\Roaming\${APP_FILENAME}"
  Push $1
  Call un.RemoveDirectoryBestEffort

  !ifdef APP_PRODUCT_FILENAME
    StrCpy $1 "$0\AppData\Roaming\${APP_PRODUCT_FILENAME}"
    Push $1
    Call un.RemoveDirectoryBestEffort
  !endif

  !ifdef APP_PACKAGE_NAME
    StrCpy $1 "$0\AppData\Roaming\${APP_PACKAGE_NAME}"
    Push $1
    Call un.RemoveDirectoryBestEffort

    StrCpy $1 "$0\AppData\Local\${APP_PACKAGE_NAME}-updater"
    Push $1
    Call un.RemoveDirectoryBestEffort

    StrCpy $1 "$0\AppData\Local\Temp\${APP_PACKAGE_NAME}"
    Push $1
    Call un.RemoveDirectoryBestEffort
  !endif

  Pop $1
  Pop $0
FunctionEnd

Function un.RemoveOtherProfileArtifacts
  Push $0
  Push $1
  Push $2
  Push $3

  Call un.IsAllUsersContext
  Pop $0
  ${If} $0 != "1"
    DetailPrint "Skipping other-profile cleanup because uninstall is not running in all-users mode."
    Goto other_profiles_done
  ${EndIf}

  StrCpy $0 0

  profile_loop:
    EnumRegKey $1 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList" $0
    IfErrors other_profiles_done
    IntOp $0 $0 + 1

    ReadRegStr $2 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\$1" "ProfileImagePath"
    StrCmp $2 "" profile_loop
    ExpandEnvStrings $2 $2
    IfFileExists "$2" 0 profile_loop

    ${GetFileName} "$2" $3
    StrCmp $3 "systemprofile" profile_loop
    StrCmp $3 "LocalService" profile_loop
    StrCmp $3 "NetworkService" profile_loop
    StrCmp $3 "Default" profile_loop
    StrCmp $3 "Public" profile_loop
    StrCmp $2 "$PROFILE" profile_loop

    DetailPrint "Cleaning profile $2"
    Push "$2"
    Call un.RemoveProfileArtifacts
    Goto profile_loop

  other_profiles_done:
    Pop $3
    Pop $2
    Pop $1
    Pop $0
FunctionEnd

!macro customUnInstallSection
  Section /o "un.${UN_CLEAN_CURRENT_PROFILE_LABEL}"
    Call un.RemoveCurrentProfileArtifacts
  SectionEnd

  Section /o "un.${UN_CLEAN_ALL_PROFILES_LABEL}"
    Call un.RemoveOtherProfileArtifacts
  SectionEnd
!macroend
!endif
