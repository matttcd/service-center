param([Parameter(Mandatory=$true)][string]$OptionsFile)
$ErrorActionPreference = 'Stop'
function Test-StagedProgram([string]$Program, [string]$Data) {
    # El instalador 1.1.0 registraba estas rutas aun si fallaba antes de crear
    # installation.json. Solo permite retomar sus versiones, nunca carpetas ajenas.
    $scRegistered = Get-ItemProperty -LiteralPath 'HKLM:\Software\ServiceCenter' -ErrorAction SilentlyContinue
    if (-not $scRegistered -or $scRegistered.AppDir -ne $Program -or $scRegistered.DataDir -ne $Data) { return $false }
    $scEntries = @(Get-ChildItem -LiteralPath $Program -Force)
    if ($scEntries.Count -ne 1 -or $scEntries[0].Name -ne 'versions' -or -not $scEntries[0].PSIsContainer -or ($scEntries[0].Attributes -band [IO.FileAttributes]::ReparsePoint)) { return $false }
    $scVersions = @(Get-ChildItem -LiteralPath $scEntries[0].FullName -Force)
    if (-not $scVersions.Count) { return $false }
    foreach ($scVersion in $scVersions) {
        if (-not $scVersion.PSIsContainer -or ($scVersion.Attributes -band [IO.FileAttributes]::ReparsePoint)) { return $false }
        $scManifestFile = Join-Path $scVersion.FullName 'manifest.json'
        if (-not (Test-Path -LiteralPath $scManifestFile -PathType Leaf)) { return $false }
        if ((Get-Item -LiteralPath $scManifestFile).Length -gt 8MB) { return $false }
        $scManifest = [IO.File]::ReadAllText($scManifestFile) | ConvertFrom-Json
        if ($scManifest.platform -ne 'win32-x64' -or $scManifest.releaseId -ne $scVersion.Name -or -not $scManifest.files) { return $false }
        $scFiles = New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
        [void]$scFiles.Add($scManifestFile)
        foreach ($scFile in $scManifest.files) {
            $scFull = [IO.Path]::GetFullPath((Join-Path $scVersion.FullName $scFile.path))
            if (-not $scFull.StartsWith($scVersion.FullName+'\',[StringComparison]::OrdinalIgnoreCase)) { return $false }
            [void]$scFiles.Add($scFull)
        }
        $scPending = New-Object 'Collections.Generic.Stack[string]'
        $scPending.Push($scVersion.FullName)
        while ($scPending.Count) {
            foreach ($scEntry in Get-ChildItem -LiteralPath $scPending.Pop() -Force) {
                if ($scEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) { return $false }
                if ($scEntry.PSIsContainer) {
                    # NSIS también extrae carpetas vacías, sin entrada en el manifiesto.
                    $scPending.Push($scEntry.FullName)
                } elseif (-not $scFiles.Contains($scEntry.FullName)) { return $false }
            }
        }
    }
    return $true
}
try {
    $scOptions = [IO.File]::ReadAllText($OptionsFile) | ConvertFrom-Json
    if ($scOptions.serviceAccount -and ($scOptions.serviceAccount -notmatch '^[^\\\r\n]+\\[^\\\r\n]+$' -or -not $scOptions.servicePassword)) { throw 'Usá una cuenta Windows EQUIPO\usuario con su contraseña, o elegí la creación automática.' }
    $scApp = [IO.Path]::GetFullPath($scOptions.appDir).TrimEnd('\')
    $scData = [IO.Path]::GetFullPath($scOptions.dataDir).TrimEnd('\')
    foreach ($scPath in @($scApp,$scData)) {
        if ($scPath -notmatch '^[A-Za-z]:\\.+' -or $scPath.Length -lt 4) { throw 'Elegí carpetas propias en discos locales; no uses la raíz de un disco.' }
        $scParent = $scPath
        while ($scParent) {
            if ((Test-Path -LiteralPath $scParent) -and ((Get-Item -LiteralPath $scParent -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Las rutas no pueden contener enlaces ni puntos de montaje.' }
            $scParent = [IO.Path]::GetDirectoryName($scParent)
        }
    }
    if ($scData.Equals($scApp,[StringComparison]::OrdinalIgnoreCase) -or $scData.StartsWith($scApp+'\',[StringComparison]::OrdinalIgnoreCase) -or $scApp.StartsWith($scData+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'El programa y los datos deben estar en carpetas separadas, sin contenerse entre sí.' }
    $scStateFile = Join-Path $scData 'installation.json'
    if (Test-Path -LiteralPath $scStateFile) {
        $scState = Get-Content -LiteralPath $scStateFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($scState.appDir -ne $scApp -or $scState.dataDir -ne $scData) { throw 'La instalación existente usa otras rutas.' }
    } else {
        if ((Test-Path -LiteralPath $scData) -and (Get-ChildItem -LiteralPath $scData -Force | Select-Object -First 1)) { throw 'La carpeta de datos ya contiene archivos sin una instalación reconocida. Elegí una carpeta nueva.' }
        if ((Test-Path -LiteralPath $scApp) -and (Get-ChildItem -LiteralPath $scApp -Force | Select-Object -First 1) -and -not (Test-StagedProgram $scApp $scData)) { throw 'La carpeta del programa contiene archivos ajenos a una instalación reconocida. Elegí una carpeta nueva.' }
    }
    foreach ($scItem in @(@($scApp,2GB),@($scData,1GB))) {
        $scDrive = New-Object IO.DriveInfo ([IO.Path]::GetPathRoot($scItem[0]))
        if ($scDrive.AvailableFreeSpace -lt $scItem[1]) { throw 'Se requieren 2 GB libres para el programa y 1 GB para los datos.' }
    }
    exit 0
} catch { Write-Host $_.Exception.Message; exit 1 }
