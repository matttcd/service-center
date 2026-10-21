# Detección compartida por el asistente y la ejecución; nunca devuelve secretos.
function Get-SCAccountSid([string]$Account) {
    if (-not $Account) { return $null }
    if ($Account.StartsWith('.\')) { $Account=$env:COMPUTERNAME+$Account.Substring(1) }
    try { return (New-Object Security.Principal.NTAccount $Account).Translate([Security.Principal.SecurityIdentifier]).Value } catch { return $null }
}
function Assert-SCLocalPath([string]$Path) {
    $scFull=[IO.Path]::GetFullPath($Path).TrimEnd('\')
    if ($scFull -notmatch '^[A-Za-z]:\\.+' -or $scFull.Length -lt 4) { throw 'Se requiere una carpeta propia en un disco local.' }
    $scParent=$scFull
    while ($scParent) {
        if ((Test-Path -LiteralPath $scParent) -and ((Get-Item -LiteralPath $scParent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Las rutas no pueden contener enlaces.' }
        $scParent=[IO.Path]::GetDirectoryName($scParent)
    }
    return $scFull
}
function Get-SCDeployment([string]$AppDir,[string]$DataDir,[string]$TargetVersion) {
    $scApp=Assert-SCLocalPath $AppDir
    $scData=Assert-SCLocalPath $DataDir
    if ($scApp -eq $scData -or $scApp.StartsWith($scData+'\',[StringComparison]::OrdinalIgnoreCase) -or $scData.StartsWith($scApp+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Programa y datos deben estar en carpetas separadas.' }
    $scResult=[pscustomobject]@{operation='install';currentVersion='';appDir=$scApp;dataDir=$scData;hostName=$env:COMPUTERNAME;httpsPort='443';serviceAccount='';preserveServiceCredentials=$false;credentialRequired=$false;needsInitialPassword=$true;state=$null}
    $scRegistered=Get-ItemProperty -LiteralPath 'HKLM:\Software\ServiceCenter' -ErrorAction SilentlyContinue
    if ($scRegistered -and $scRegistered.AppDir -and ($scRegistered.AppDir -ne $scApp -or $scRegistered.DataDir -ne $scData)) { throw 'Las rutas no coinciden con la instalación registrada.' }
    $scStateFile=Join-Path $scData 'installation.json'
    if (-not (Test-Path -LiteralPath $scStateFile)) {
        foreach ($scId in @('ServiceCenterApp','ServiceCenterHttps','ServiceCenterPostgres')) {
            if (Get-CimInstance Win32_Service -Filter "Name='$scId'") { throw 'Hay servicios existentes sin metadatos coincidentes. Recuperá el registro y la carpeta de datos original.' }
        }
        if ($scRegistered -and $scRegistered.AppDir) { $scResult.operation='repair' }
        return $scResult
    }
    $scState=Get-Content -LiteralPath $scStateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($scState.appDir -ne $scApp -or $scState.dataDir -ne $scData -or $scState.status -notin @('ready','installing','uninstalled')) { throw 'El estado de la instalación no coincide con estas carpetas.' }
    $scRelease=Assert-SCLocalPath $scState.releaseDir
    if (-not $scRelease.StartsWith($scApp+'\versions\',[StringComparison]::OrdinalIgnoreCase)) { throw 'La versión registrada está fuera del programa.' }
    $scManifestFile=Join-Path $scRelease 'manifest.json'
    if (Test-Path -LiteralPath $scManifestFile) {
        $scManifest=Get-Content -LiteralPath $scManifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($scManifest.platform -ne 'win32-x64' -or $scManifest.releaseId -ne [IO.Path]::GetFileName($scRelease) -or $scManifest.version -ne $scState.version) { throw 'El manifiesto no coincide con la instalación.' }
    } elseif ($scState.status -ne 'uninstalled') { throw 'Falta el manifiesto de una instalación activa.' }
    if ([version]$TargetVersion -lt [version]$scState.version) { throw 'No se puede instalar una versión anterior. Usá una copia y su procedimiento de recuperación.' }
    $scResult.state=$scState
    $scResult.currentVersion=[string]$scState.version
    $scResult.hostName=[string]$scState.hostName
    $scResult.httpsPort=[string]$scState.httpsPort
    $scResult.needsInitialPassword=-not (Test-Path -LiteralPath (Join-Path $scData 'config/service.json'))
    if ($scResult.needsInitialPassword -and (Test-Path -LiteralPath (Join-Path $scData 'postgres/PG_VERSION'))) { throw 'Falta la configuración protegida de una base existente. Recuperá su configuración; no se generarán claves nuevas.' }
    $scManaged=$scState.serviceAccount -ieq "$env:COMPUTERNAME\ServiceCenterSvc"
    if (-not $scManaged) { $scResult.serviceAccount=[string]$scState.serviceAccount }
    $scSid=Get-SCAccountSid $scState.serviceAccount
    if (-not $scSid -or $scSid -ne $scState.serviceSid) { throw 'La cuenta del servicio falta o cambió de identidad. Se requiere revisar la cuenta original.' }
    $scPreserve=$true
    foreach ($scId in @('ServiceCenterApp','ServiceCenterHttps','ServiceCenterPostgres')) {
        $scService=Get-CimInstance Win32_Service -Filter "Name='$scId'"
        if ($scService) {
            if ($scService.PathName.IndexOf($scApp+'\',[StringComparison]::OrdinalIgnoreCase) -lt 0) { throw "El servicio $scId pertenece a otro programa." }
            if ($scId -ne 'ServiceCenterPostgres' -and (Get-SCAccountSid $scService.StartName) -ne $scSid) { $scPreserve=$false }
        } else { $scPreserve=$false }
    }
    $scResult.preserveServiceCredentials=$scPreserve
    $scResult.credentialRequired=(-not $scManaged -and -not $scPreserve)
    $scResult.operation=if ($scState.status -eq 'uninstalled') {'reinstall'} elseif ($scState.status -ne 'ready' -or -not $scPreserve -or [version]$TargetVersion -eq [version]$scState.version) {'repair'} else {'update'}
    return $scResult
}
