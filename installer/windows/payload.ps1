# Archivos de programa inmutables: compartir datos verificados, nunca sobrescribirlos.
function Get-SCPayloadFiles([string]$Release,[object]$Manifest) {
    $scRoot=Assert-SCLocalPath $Release
    if ($Manifest.platform -ne 'win32-x64' -or $Manifest.releaseId -ne [IO.Path]::GetFileName($scRoot) -or -not $Manifest.files) { throw 'Manifiesto del programa inválido.' }
    $scNames=New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($scEntry in $Manifest.files) {
        $scRelative=[string]$scEntry.path
        if (-not $scRelative -or $scRelative -match '[\x00-\x1f:*?"<>|\\]' -or $scRelative.StartsWith('/') -or @($scRelative.Split('/') | Where-Object { $_ -in @('','.','..') }).Count -or $scRelative -ieq 'manifest.json') { throw 'Ruta inválida en el manifiesto.' }
        $scFile=[IO.Path]::GetFullPath((Join-Path $scRoot $scRelative))
        if (-not $scFile.StartsWith($scRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or -not $scNames.Add($scFile) -or $scEntry.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or $null -eq $scEntry.size -or [long]$scEntry.size -lt 0) { throw 'Archivo inválido o repetido en el manifiesto.' }
        [pscustomobject]@{relative=$scRelative;path=$scFile;size=[long]$scEntry.size;sha256=[string]$scEntry.sha256}
    }
}
function Assert-SCPayloadTree([string]$Root,[object]$Owned) {
    if (-not [IO.Directory]::Exists($Root)) { return }
    $scPending=New-Object 'Collections.Generic.Stack[string]'
    $scPending.Push($Root)
    while ($scPending.Count) {
        foreach ($scPath in [IO.Directory]::EnumerateFileSystemEntries($scPending.Pop())) {
            $scAttributes=[IO.File]::GetAttributes($scPath)
            if ($scAttributes -band [IO.FileAttributes]::ReparsePoint) { throw 'El programa contiene un enlace o punto de montaje inesperado.' }
            if ($scAttributes -band [IO.FileAttributes]::Directory) { $scPending.Push($scPath) }
            elseif ($Owned -and -not $Owned.Contains($scPath)) { throw 'La carpeta de destino contiene archivos ajenos al paquete.' }
        }
    }
}
function Get-SCPayloadHash([string]$File) {
    $scHash=[Security.Cryptography.SHA256]::Create()
    $scStream=[IO.File]::OpenRead($File)
    try { return ([BitConverter]::ToString($scHash.ComputeHash($scStream))).Replace('-','') }
    finally { $scStream.Dispose(); $scHash.Dispose() }
}
function Test-SCPayloadFile([object]$Entry) {
    if (-not [IO.File]::Exists($Entry.path)) { return $false }
    if ((New-Object IO.FileInfo $Entry.path).Length -ne $Entry.size) { return $false }
    return (Get-SCPayloadHash $Entry.path) -eq $Entry.sha256
}
function New-SCPayloadLink([string]$Target,[string]$Source) {
    try { New-Item -ItemType HardLink -Path $Target -Value $Source -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}
function Initialize-SCPayload([string]$Release,[string]$ManifestFile,[string]$PreviousRelease,[switch]$Verify) {
    $scRoot=Assert-SCLocalPath $Release
    if ((Get-Item -LiteralPath $ManifestFile).Length -gt 8MB) { throw 'Manifiesto demasiado grande.' }
    $scManifest=[IO.File]::ReadAllText($ManifestFile) | ConvertFrom-Json
    $scFiles=@(Get-SCPayloadFiles $scRoot $scManifest)
    $scOwned=New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($scFile in $scFiles) { [void]$scOwned.Add($scFile.path) }
    $scInstalledManifest=Join-Path $scRoot 'manifest.json'
    [void]$scOwned.Add($scInstalledManifest)
    Assert-SCPayloadTree $scRoot $scOwned
    $scPrevious=$null
    $scOldNames=New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    if ($PreviousRelease) {
        $scPrevious=Assert-SCLocalPath $PreviousRelease
        Assert-SCPayloadTree $scPrevious $null
        $scOldManifest=Join-Path $scPrevious 'manifest.json'
        if ([IO.File]::Exists($scOldManifest)) {
            if ((Get-Item -LiteralPath $scOldManifest).Length -gt 8MB) { throw 'Manifiesto anterior demasiado grande.' }
            $scOld=[IO.File]::ReadAllText($scOldManifest) | ConvertFrom-Json
            if ($scOld.platform -ne 'win32-x64' -or $scOld.releaseId -ne [IO.Path]::GetFileName($scPrevious)) { throw 'La versión anterior no tiene un manifiesto válido.' }
            foreach ($scEntry in $scOld.files) { [void]$scOldNames.Add([string]$scEntry.path) }
        }
    }
    $scResult=[pscustomobject]@{existing=0;linked=0;copied=0;extract=0;reusedBytes=[long]0;extractBytes=[long]0;verified=0}
    # Validar todo antes de modificar el destino; nunca reparar en sitio un binario activo.
    $scInvalid=@($scFiles | Where-Object { [IO.File]::Exists($_.path) -and -not (Test-SCPayloadFile $_) })
    $scManifestInvalid=[IO.File]::Exists($scInstalledManifest) -and ((Get-SCPayloadHash $scInstalledManifest) -ne (Get-SCPayloadHash $ManifestFile))
    if (($scInvalid.Count -or $scManifestInvalid) -and ($Verify -or $scRoot -eq $scPrevious)) { throw 'La versión contiene archivos dañados. No se modificará una versión activa; usá un paquete de versión nueva para recuperarla.' }
    if ($Verify) {
        foreach ($scFile in $scFiles) {
            if (-not (Test-SCPayloadFile $scFile)) { throw "Archivo incompleto o modificado: $($scFile.relative)" }
            $scResult.verified++
        }
        if (-not [IO.File]::Exists($scInstalledManifest) -or $scManifestInvalid) { throw 'Falta el manifiesto del programa extraído.' }
        return $scResult
    }
    foreach ($scFile in $scInvalid) { [IO.File]::Delete($scFile.path) }
    if ($scManifestInvalid) { [IO.File]::Delete($scInstalledManifest) }
    [void][IO.Directory]::CreateDirectory($scRoot)
    foreach ($scFile in $scFiles) {
        if (Test-SCPayloadFile $scFile) { $scResult.existing++; $scResult.reusedBytes+=$scFile.size; continue }
        if ($scPrevious -and $scOldNames.Contains($scFile.relative)) {
            $scSource=[pscustomobject]@{path=(Join-Path $scPrevious $scFile.relative);size=$scFile.size;sha256=$scFile.sha256}
            if (Test-SCPayloadFile $scSource) {
                [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($scFile.path))
                if (New-SCPayloadLink $scFile.path $scSource.path) { $scResult.linked++ }
                else { [IO.File]::Copy($scSource.path,$scFile.path,$false); $scResult.copied++ }
                $scResult.reusedBytes+=$scFile.size
                continue
            }
        }
        $scResult.extract++; $scResult.extractBytes+=$scFile.size
    }
    return $scResult
}
