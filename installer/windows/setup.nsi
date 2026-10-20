# -*- coding: utf-8 -*-
Unicode true
RequestExecutionLevel admin
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
!ifndef AppVersion
  !define AppVersion "1.1.0"
!endif
!ifndef ReleaseId
  !define ReleaseId "${AppVersion}"
!endif
!ifndef StageDir
  !error "Ejecutar npm run build:windows"
!endif
!ifndef OutputPath
  !define OutputPath "..\..\release"
!endif
Name "Service Center ${AppVersion}"
OutFile "${OutputPath}\ServiceCenter-Setup-${AppVersion}.exe"
InstallDir "$PROGRAMFILES64\ServiceCenter"
SetCompressor /SOLID zlib
ShowInstDetails show
ShowUninstDetails show
VIProductVersion "${AppVersion}.0"
VIAddVersionKey /LANG=1034 "ProductName" "Service Center"
VIAddVersionKey /LANG=1034 "FileDescription" "Instalador local de Service Center"
VIAddVersionKey /LANG=1034 "FileVersion" "${AppVersion}"
VIAddVersionKey /LANG=1034 "LegalCopyright" "Service Center"
Var DataDir
Var HostName
Var HttpsPort
Var Account
Var AccountPassword
Var AdminPassword
Var ConfirmPassword
Var Dialog
Var Field1
Var Field2
Var OptionsFile
Var JsonHandle
Var PowerShell
Var OldApp
Var ReleaseDir

!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE DirectoryLeave
!insertmacro MUI_PAGE_DIRECTORY
Page custom DataPage DataLeave
Page custom NetworkPage NetworkLeave
Page custom AccountPage AccountLeave
Page custom PasswordPage PasswordLeave
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TEXT "Service Center está disponible por HTTPS. Configurá las impresoras desde Configuración → Impresoras.$\r$\n$\r$\nEl certificado público y las instrucciones para otras PC están en la carpeta de datos."
!insertmacro MUI_PAGE_FINISH
!define MUI_UNCONFIRMPAGE_TEXT_TOP "Se retirarán los servicios y el programa. Se conservarán la base de datos, las claves, certificados y respaldos."
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

Function .onInit
  IfSilent 0 +3
    SetErrorLevel 1
    Quit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "Se requiere Windows x64."
    Abort
  ${EndIf}
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_ICONSTOP "Se requiere Windows 10 o posterior."
    Abort
  ${EndIf}
  SetRegView 64
  SetShellVarContext all
  StrCpy $PowerShell "$WINDIR\sysnative\WindowsPowerShell\v1.0\powershell.exe"
  IfFileExists "E:\*.*" 0 +3
    StrCpy $INSTDIR "E:\ServiceCenter"
    StrCpy $DataDir "E:\ServiceCenterData"
  ${If} $DataDir == ""
    StrCpy $DataDir "$APPDATA\ServiceCenter"
  ${EndIf}
  ReadRegStr $OldApp HKLM "Software\ServiceCenter" "AppDir"
  ${If} $OldApp != ""
    StrCpy $INSTDIR $OldApp
    ReadRegStr $DataDir HKLM "Software\ServiceCenter" "DataDir"
  ${EndIf}
  ReadEnvStr $HostName COMPUTERNAME
  StrCpy $HttpsPort "443"
  ReadRegStr $0 HKLM "Software\ServiceCenter" "HostName"
  ${If} $0 != ""
    StrCpy $HostName $0
    ReadRegStr $HttpsPort HKLM "Software\ServiceCenter" "HttpsPort"
  ${EndIf}
  ReadRegStr $Account HKLM "Software\ServiceCenter" "CustomServiceAccount"
  InitPluginsDir
  StrCpy $OptionsFile "$PLUGINSDIR\options.json"
FunctionEnd

Function DirectoryLeave
  ${If} $OldApp != ""
  ${AndIf} $INSTDIR != $OldApp
    MessageBox MB_ICONSTOP "Para actualizar, conservá la carpeta del programa existente."
    Abort
  ${EndIf}
FunctionEnd

Function DataPage
  !insertmacro MUI_HEADER_TEXT "Base de datos y respaldos" "Esta carpeta se conserva al actualizar o desinstalar."
  nsDialogs::Create 1018
  Pop $Dialog
  ${NSD_CreateLabel} 0 0 100% 30u "Elegí una carpeta en un disco local, fuera de la carpeta del programa. Podés escribir la ruta completa."
  Pop $0
  ${NSD_CreateDirRequest} 0 40u 100% 14u "$DataDir"
  Pop $Field1
  IfFileExists "$DataDir\installation.json" 0 +2
    SendMessage $Field1 ${EM_SETREADONLY} 1 0
  nsDialogs::Show
FunctionEnd
Function DataLeave
  ${NSD_GetText} $Field1 $DataDir
  ${If} $DataDir == ""
    MessageBox MB_ICONSTOP "Ingresá una carpeta para los datos."
    Abort
  ${EndIf}
FunctionEnd

Function NetworkPage
  !insertmacro MUI_HEADER_TEXT "Acceso del local" "Solo se publicará HTTPS en la red privada."
  nsDialogs::Create 1018
  Pop $Dialog
  ${NSD_CreateLabel} 0 0 100% 20u "Nombre de equipo o IP fija de la PC servidora:"
  Pop $0
  ${NSD_CreateText} 0 24u 100% 14u "$HostName"
  Pop $Field1
  ${NSD_CreateLabel} 0 50u 100% 14u "Puerto HTTPS:"
  Pop $0
  ${NSD_CreateNumber} 0 68u 80u 14u "$HttpsPort"
  Pop $Field2
  ${NSD_CreateLabel} 0 100u 100% 28u "Las otras PC usarán este nombre o IP. El instalador entrega el certificado público para habilitar HTTPS en sus navegadores."
  Pop $0
  nsDialogs::Show
FunctionEnd
Function NetworkLeave
  ${NSD_GetText} $Field1 $HostName
  ${NSD_GetText} $Field2 $HttpsPort
  ${If} $HostName == ""
  ${OrIf} $HttpsPort < 1
  ${OrIf} $HttpsPort > 65535
    MessageBox MB_ICONSTOP "Ingresá un nombre o IP y un puerto válido."
    Abort
  ${EndIf}
FunctionEnd

Function AccountPage
  !insertmacro MUI_HEADER_TEXT "Cuenta de impresión" "Dejá vacío para crear una cuenta de servicio sin privilegios."
  nsDialogs::Create 1018
  Pop $Dialog
  ${NSD_CreateLabel} 0 0 100% 33u "Para colas compartidas con autenticación, podés usar una cuenta Windows existente sin permisos de administrador y con acceso a esas impresoras."
  Pop $0
  ${NSD_CreateLabel} 0 40u 100% 14u "Cuenta opcional (EQUIPO\usuario o DOMINIO\usuario):"
  Pop $0
  ${NSD_CreateText} 0 57u 100% 14u "$Account"
  Pop $Field1
  ${NSD_CreateLabel} 0 80u 100% 14u "Contraseña de esa cuenta:"
  Pop $0
  ${NSD_CreatePassword} 0 97u 100% 14u "$AccountPassword"
  Pop $Field2
  nsDialogs::Show
FunctionEnd
Function AccountLeave
  ${NSD_GetText} $Field1 $Account
  ${NSD_GetText} $Field2 $AccountPassword
  ${If} $Account != ""
  ${AndIf} $AccountPassword == ""
    MessageBox MB_ICONSTOP "Ingresá la contraseña de la cuenta Windows."
    Abort
  ${EndIf}
FunctionEnd

Function PasswordPage
  IfFileExists "$DataDir\config\service.json" 0 +2
    Abort
  !insertmacro MUI_HEADER_TEXT "Administrador del sistema" "Elegí la contraseña inicial de la aplicación."
  nsDialogs::Create 1018
  Pop $Dialog
  ${NSD_CreateLabel} 0 0 100% 25u "Requiere al menos 8 caracteres y hasta 72 bytes UTF-8. Podés cambiarla después desde tu perfil."
  Pop $0
  ${NSD_CreateLabel} 0 35u 100% 14u "Contraseña inicial:"
  Pop $0
  ${NSD_CreatePassword} 0 52u 100% 14u "$AdminPassword"
  Pop $Field1
  ${NSD_CreateLabel} 0 78u 100% 14u "Repetir contraseña:"
  Pop $0
  ${NSD_CreatePassword} 0 95u 100% 14u "$ConfirmPassword"
  Pop $Field2
  nsDialogs::Show
FunctionEnd
Function PasswordLeave
  ${NSD_GetText} $Field1 $AdminPassword
  ${NSD_GetText} $Field2 $ConfirmPassword
  StrLen $0 $AdminPassword
  ${If} $0 < 8
  ${OrIf} $AdminPassword != $ConfirmPassword
    MessageBox MB_ICONSTOP "Las contraseñas deben coincidir y tener al menos 8 caracteres."
    Abort
  ${EndIf}
FunctionEnd

; Escribe por campo para evitar el límite de 1024 caracteres de una variable NSIS.
; UTF-16 con BOM preserva nombres y contraseñas; .NET detecta su codificación.
Function WriteJsonString
  Pop $R0
  FileWriteUTF16LE $JsonHandle '"'
  StrCpy $R1 0
  loop:
    StrCpy $R2 $R0 1 $R1
    StrCmp $R2 "" done
    StrCmp $R2 '\' slash
    StrCmp $R2 '"' quote
    StrCmp $R2 "$\r" cr
    StrCmp $R2 "$\n" lf
    StrCmp $R2 "$\t" tab
    Goto write
    slash:
      StrCpy $R2 '\\'
      Goto write
    quote:
      StrCpy $R2 '\"'
      Goto write
    cr:
      StrCpy $R2 '\r'
      Goto write
    lf:
      StrCpy $R2 '\n'
      Goto write
    tab:
      StrCpy $R2 '\t'
    write:
    FileWriteUTF16LE $JsonHandle $R2
    IntOp $R1 $R1 + 1
    Goto loop
  done:
  FileWriteUTF16LE $JsonHandle '"'
FunctionEnd
!macro JsonField Name Value
  FileWriteUTF16LE $JsonHandle '"${Name}":'
  Push "${Value}"
  Call WriteJsonString
!macroend

Section "Instalar"
  StrCpy $ReleaseDir "$INSTDIR\versions\${ReleaseId}"
  ClearErrors
  FileOpen $JsonHandle $OptionsFile w
  FileWriteUTF16LE /BOM $JsonHandle '{'
  !insertmacro JsonField appDir $INSTDIR
  FileWriteUTF16LE $JsonHandle ','
  !insertmacro JsonField releaseDir $ReleaseDir
  FileWriteUTF16LE $JsonHandle ','
  !insertmacro JsonField dataDir $DataDir
  FileWriteUTF16LE $JsonHandle ','
  !insertmacro JsonField hostName $HostName
  FileWriteUTF16LE $JsonHandle ','
  !insertmacro JsonField httpsPort $HttpsPort
  FileWriteUTF16LE $JsonHandle ','
  !insertmacro JsonField version ${AppVersion}
  FileWriteUTF16LE $JsonHandle ','
  !insertmacro JsonField adminPassword $AdminPassword
  FileWriteUTF16LE $JsonHandle ','
  !insertmacro JsonField serviceAccount $Account
  FileWriteUTF16LE $JsonHandle ','
  !insertmacro JsonField servicePassword $AccountPassword
  FileWriteUTF16LE $JsonHandle '}'
  FileClose $JsonHandle
  IfErrors optionsFailed
  SetOutPath "$PLUGINSDIR"
  File /oname=preflight.ps1 "${StageDir}\installer\windows\preflight.ps1"
  nsExec::ExecToLog '"$PowerShell" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\preflight.ps1" -OptionsFile "$OptionsFile"'
  Pop $0
  ${If} $0 != 0
    Delete $OptionsFile
    MessageBox MB_ICONSTOP "Revisá las rutas y el espacio disponible. El detalle aparece en el registro del asistente."
    SetErrorLevel 1
    Abort
  ${EndIf}
  SetOutPath "$ReleaseDir"
  SetOverwrite off
  ClearErrors
  File /r "${StageDir}\*"
  SetOverwrite on
  ${If} ${Errors}
    Delete $OptionsFile
    MessageBox MB_ICONSTOP "No se pudieron copiar todos los archivos. Revisá el espacio y los permisos antes de reparar la instalación."
    SetErrorLevel 1
    Abort
  ${EndIf}
  DetailPrint 'Comprobando Microsoft Visual C++ Runtime...'
  nsExec::ExecToLog '"$ReleaseDir\runtime\vcredist.exe" /install /quiet /norestart'
  Pop $0
  ${If} $0 == 3010
    SetRebootFlag true
  ${ElseIf} $0 != 0
  ${AndIf} $0 != 1638
    Delete $OptionsFile
    MessageBox MB_ICONSTOP "No se pudo preparar Visual C++ Runtime. Código: $0. Revisá los registros de Windows antes de continuar."
    SetErrorLevel 1
    Abort
  ${EndIf}
  nsExec::ExecToLog '"$PowerShell" -NoProfile -ExecutionPolicy Bypass -File "$ReleaseDir\installer\windows\install.ps1" -OptionsFile "$OptionsFile"'
  Pop $0
  Delete $OptionsFile
  StrCpy $AdminPassword ""
  StrCpy $ConfirmPassword ""
  StrCpy $AccountPassword ""
  ; Mantener rutas para reparar incluso si falló la configuración de servicios.
  WriteRegStr HKLM "Software\ServiceCenter" "AppDir" "$INSTDIR"
  WriteRegStr HKLM "Software\ServiceCenter" "DataDir" "$DataDir"
  WriteRegStr HKLM "Software\ServiceCenter" "HostName" "$HostName"
  WriteRegStr HKLM "Software\ServiceCenter" "HttpsPort" "$HttpsPort"
  WriteRegStr HKLM "Software\ServiceCenter" "CustomServiceAccount" "$Account"
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "No se completó la instalación de servicios. Se conservaron los datos y respaldos. Revisá los registros y ejecutá nuevamente el instalador para reparar."
    SetErrorLevel 1
    Abort
  ${EndIf}
  WriteRegStr HKLM "Software\ServiceCenter" "ReleaseDir" "$ReleaseDir"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ServiceCenter" "DisplayName" "Service Center"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ServiceCenter" "DisplayVersion" "${AppVersion}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ServiceCenter" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ServiceCenter" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ServiceCenter" "NoRepair" 1
  CreateDirectory "$SMPROGRAMS\Service Center"
  WriteINIStr "$SMPROGRAMS\Service Center\Abrir Service Center.url" "InternetShortcut" "URL" "https://localhost:$HttpsPort"
  CreateShortcut "$SMPROGRAMS\Service Center\Carpeta de datos y respaldos.lnk" "$DataDir"
  ; Explorer es x64: sysnative solo existe para el proceso NSIS de 32 bits.
  CreateShortcut "$SMPROGRAMS\Service Center\Recuperar una copia.lnk" "$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" '-NoExit -NoProfile -ExecutionPolicy Bypass -File "$ReleaseDir\installer\windows\restore.ps1" -DataDir "$DataDir"'
  Goto end
  optionsFailed:
    Delete $OptionsFile
    MessageBox MB_ICONSTOP "No se pudo preparar la configuración."
    SetErrorLevel 1
    Abort
  end:
SectionEnd

Function un.onInit
  SetRegView 64
  SetShellVarContext all
  ReadRegStr $OldApp HKLM "Software\ServiceCenter" "AppDir"
  ${If} $INSTDIR != $OldApp
    MessageBox MB_ICONSTOP "La ruta no coincide con la instalación registrada."
    Abort
  ${EndIf}
  ReadRegStr $DataDir HKLM "Software\ServiceCenter" "DataDir"
  ReadRegStr $ReleaseDir HKLM "Software\ServiceCenter" "ReleaseDir"
  StrCpy $PowerShell "$WINDIR\sysnative\WindowsPowerShell\v1.0\powershell.exe"
FunctionEnd
Section "Uninstall"
  SetOutPath "$TEMP"
  nsExec::ExecToLog '"$PowerShell" -NoProfile -ExecutionPolicy Bypass -File "$ReleaseDir\installer\windows\uninstall.ps1" -AppDir "$INSTDIR" -DataDir "$DataDir"'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "No se pudieron retirar los servicios. Se conserva el programa para revisar el problema."
    SetErrorLevel 1
    Abort
  ${EndIf}
  Delete "$SMPROGRAMS\Service Center\Abrir Service Center.url"
  Delete "$SMPROGRAMS\Service Center\Carpeta de datos y respaldos.lnk"
  Delete "$SMPROGRAMS\Service Center\Recuperar una copia.lnk"
  RMDir "$SMPROGRAMS\Service Center"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ServiceCenter"
  ; Se conserva Software\ServiceCenter para reinstalar con los mismos datos.
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
