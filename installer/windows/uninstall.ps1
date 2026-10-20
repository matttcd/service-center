param([Parameter(Mandatory=$true)][string]$AppDir, [Parameter(Mandatory=$true)][string]$DataDir)
$ErrorActionPreference = 'Stop'
$scState = Get-Content -LiteralPath (Join-Path $DataDir 'installation.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ([IO.Path]::GetFullPath($AppDir) -ne $scState.appDir -or [IO.Path]::GetFullPath($DataDir) -ne $scState.dataDir) { throw 'La instalación no coincide con estas rutas.' }
$scAppRoot = [IO.Path]::GetFullPath($AppDir).TrimEnd('\')
$scDataRoot = [IO.Path]::GetFullPath($DataDir).TrimEnd('\')
if ($scAppRoot.Length -lt 4 -or $scDataRoot.Equals($scAppRoot,[StringComparison]::OrdinalIgnoreCase) -or $scDataRoot.StartsWith($scAppRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Rutas de desinstalación inseguras.' }
$scVersions = Join-Path $scAppRoot 'versions'
# Valida las rutas finales antes de eliminar archivos. No sigue junctions.
$scParent = $scVersions
while ($scParent) {
    if ((Test-Path -LiteralPath $scParent) -and ((Get-Item -LiteralPath $scParent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'No se desinstalará desde un enlace.' }
    $scParent = [IO.Path]::GetDirectoryName($scParent)
}
$scOwnedFiles = @()
$scOwnedDirectories = New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
foreach ($scVersion in @(Get-ChildItem -LiteralPath $scVersions -Directory -ErrorAction SilentlyContinue)) {
    if ($scVersion.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Hay un enlace en las versiones del programa.' }
    $scManifestFile = Join-Path $scVersion.FullName 'manifest.json'
    if (-not (Test-Path -LiteralPath $scManifestFile)) { continue }
    $scManifest = Get-Content -LiteralPath $scManifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($scManifest.releaseId -ne $scVersion.Name -or $scManifest.platform -ne 'win32-x64') { throw 'Manifiesto de desinstalación inválido.' }
    foreach ($scEntry in $scManifest.files) {
        $scFile = [IO.Path]::GetFullPath((Join-Path $scVersion.FullName $scEntry.path))
        if (-not $scFile.StartsWith($scVersion.FullName+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Un archivo del manifiesto sale de la carpeta del programa.' }
        $scParent = $scFile
        while ($scParent -ne $scVersion.FullName) {
            if ((Test-Path -LiteralPath $scParent) -and ((Get-Item -LiteralPath $scParent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'El programa contiene un enlace inesperado.' }
            $scParent = [IO.Path]::GetDirectoryName($scParent)
            [void]$scOwnedDirectories.Add($scParent)
        }
        $scOwnedFiles += $scFile
    }
    $scOwnedFiles += $scManifestFile
}
foreach ($scId in @('ServiceCenterHttps','ServiceCenterApp','ServiceCenterPostgres')) {
    $scService = Get-CimInstance Win32_Service -Filter "Name='$scId'"
    if (-not $scService) { continue }
    if ($scService.PathName.IndexOf($scState.appDir.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -lt 0) { throw "No se quitará un servicio ajeno: $scId" }
    Stop-Service -Name $scId -ErrorAction Stop
    (Get-Service $scId).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(60))
    $scResult = Invoke-CimMethod -InputObject $scService -MethodName Delete
    if ($scResult.ReturnValue -ne 0) { throw "No se pudo quitar $scId." }
}
Get-NetFirewallRule -Name ServiceCenterHttps -ErrorAction SilentlyContinue | Remove-NetFirewallRule
$scState.status = 'uninstalled'
[IO.File]::WriteAllText((Join-Path $DataDir 'installation.json'), (ConvertTo-Json $scState), (New-Object Text.UTF8Encoding $false))
foreach ($scFile in $scOwnedFiles) { if (Test-Path -LiteralPath $scFile -PathType Leaf) { Remove-Item -LiteralPath $scFile -Force } }
# Solo directorios vacíos: nunca borra recursivamente datos o archivos ajenos.
if (Test-Path -LiteralPath $scVersions) {
    $scOwnedDirectories | Sort-Object Length -Descending | ForEach-Object {
        if ((Test-Path -LiteralPath $_ -PathType Container) -and -not (Get-ChildItem -LiteralPath $_ -Force | Select-Object -First 1)) { Remove-Item -LiteralPath $_ }
    }
    if (-not (Get-ChildItem -LiteralPath $scVersions -Force | Select-Object -First 1)) { Remove-Item -LiteralPath $scVersions }
}
foreach ($scId in @('ServiceCenterHttps','ServiceCenterApp')) {
    $scServiceDirectory = Join-Path $scAppRoot 'services'
    if ((Test-Path -LiteralPath $scServiceDirectory) -and ((Get-Item -LiteralPath $scServiceDirectory -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'La carpeta de servicios contiene un enlace inesperado.' }
    foreach ($scExt in @('.exe','.xml')) {
        $scFile = Join-Path $scAppRoot ('services\' + $scId + $scExt)
        if (Test-Path -LiteralPath $scFile -PathType Leaf) { Remove-Item -LiteralPath $scFile -Force }
    }
}
Write-Host 'Servicios retirados. Se conservaron la base, las claves, certificados, respaldos y la cuenta de servicio.'
