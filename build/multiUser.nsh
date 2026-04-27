!include FileFunc.nsh
!include UAC.nsh

!define /ifndef INSTALL_REGISTRY_KEY "Software\${APP_GUID}"
!define /ifndef UNINSTALL_REGISTRY_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"

# current Install Mode ("all" or "CurrentUser")
Var installMode

!ifndef INSTALL_MODE_PER_ALL_USERS
  !ifndef ONE_CLICK
    Var hasPerUserInstallation
    Var hasPerMachineInstallation
  !endif
  Var PerUserInstallationFolder

  !macro setInstallModePerUser
    StrCpy $installMode CurrentUser
    SetShellVarContext current

    # Check the registry for a previous per-user install path first.
    ReadRegStr $perUserInstallationFolder HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${if} $perUserInstallationFolder != ""
      StrCpy $INSTDIR $perUserInstallationFolder
    ${else}
      # Avoid the SHGetKnownFolderPath System.dll crash on some Windows 11 builds.
      StrCpy $0 "$LocalAppData\Programs"
      StrCpy $INSTDIR "$0\${APP_FILENAME}"
    ${endif}

    # allow /D switch to override installation path https://github.com/electron-userland/electron-builder/issues/1551
    !insertmacro GetDParameter $R0
    ${If} $R0 != ""
      StrCpy $INSTDIR $R0
    ${endif}

  !macroend
!endif

!ifdef INSTALL_MODE_PER_ALL_USERS_REQUIRED
  Var perMachineInstallationFolder

  !macro setInstallModePerAllUsers
    StrCpy $installMode all
    SetShellVarContext all

    !ifdef BUILD_UNINSTALLER
      ${IfNot} ${UAC_IsAdmin}
        ShowWindow $HWNDPARENT ${SW_HIDE}
        !insertmacro UAC_RunElevated
        Quit
      ${endif}
    !endif

    # Check the registry for a previous machine-wide install path first.
    ReadRegStr $perMachineInstallationFolder HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${if} $perMachineInstallationFolder != ""
      StrCpy $INSTDIR $perMachineInstallationFolder
    ${else}
      StrCpy $0 "$PROGRAMFILES"
      !ifdef APP_64
        ${if} ${RunningX64}
          StrCpy $0 "$PROGRAMFILES64"
        ${endif}
      !endif

      !ifdef MENU_FILENAME
        StrCpy $0 "$0\${MENU_FILENAME}"
      !endif

      StrCpy $INSTDIR "$0\${APP_FILENAME}"
    ${endif}

    # allow /D switch to override installation path https://github.com/electron-userland/electron-builder/issues/1551
    !insertmacro GetDParameter $R0
    ${If} $R0 != ""
      StrCpy $INSTDIR $R0
    ${endif}

  !macroend
!endif

# Custom function to handle /D parameter with spaces
# The /D parameter is special in NSIS - it must be the last parameter and cannot have quotes
# Use StdUtils.GetParameter to get the full command line, then parse /D= manually
!macro GetDParameter outVar
  Push $R8
  Push $R9
  Push $R7
  Push $R6
  Push $R5

  # Get the complete command line using StdUtils (including /D parameter)
  ${StdUtils.GetAllParameters} $R8 "0"

  # Initialize result
  StrCpy $R9 ""

  # Search for /D= or /d= using a simple loop
  StrLen $R7 $R8
  IntOp $R7 $R7 - 2  # Don't check last 2 characters
  StrCpy $R6 0

  ${Do}
    StrCpy $R5 $R8 3 $R6  # Get 3 characters starting at position $R6
    ${If} $R5 == "/D="
    ${OrIf} $R5 == "/d="
      # Found /D= or /d=, extract everything after it
      IntOp $R6 $R6 + 3
      StrCpy $R9 $R8 "" $R6
      ${Break}
    ${EndIf}
    IntOp $R6 $R6 + 1
  ${LoopUntil} $R6 > $R7

  StrCpy ${outVar} $R9
  Pop $R5
  Pop $R6
  Pop $R7
  Pop $R9
  Pop $R8
!macroend
