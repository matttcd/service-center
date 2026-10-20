param([Parameter(Mandatory=$true)][string]$OptionsFile)
$ErrorActionPreference = 'Stop'
try {
    $scOptions = [IO.File]::ReadAllText($OptionsFile) | ConvertFrom-Json
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
        foreach ($scPath in @($scApp,$scData)) {
            if ((Test-Path -LiteralPath $scPath) -and (Get-ChildItem -LiteralPath $scPath -Force | Select-Object -First 1)) { throw 'Elegí carpetas nuevas: una de las rutas ya contiene archivos.' }
        }
    }
    foreach ($scItem in @(@($scApp,2GB),@($scData,1GB))) {
        $scDrive = New-Object IO.DriveInfo ([IO.Path]::GetPathRoot($scItem[0]))
        if ($scDrive.AvailableFreeSpace -lt $scItem[1]) { throw 'Se requieren 2 GB libres para el programa y 1 GB para los datos.' }
    }
    exit 0
} catch { Write-Host $_.Exception.Message; exit 1 }
