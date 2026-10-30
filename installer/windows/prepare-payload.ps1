param([Parameter(Mandatory=$true)][string]$OptionsFile,[Parameter(Mandatory=$true)][string]$ManifestFile,[switch]$Verify)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'deployment.ps1')
. (Join-Path $PSScriptRoot 'payload.ps1')
try {
    $scOptions=[IO.File]::ReadAllText($OptionsFile) | ConvertFrom-Json
    $scDetected=Get-SCDeployment $scOptions.appDir $scOptions.dataDir $scOptions.version
    if ($scOptions.operation -ne $scDetected.operation -or [bool]::Parse([string]$scOptions.preserveServiceCredentials) -ne $scDetected.preserveServiceCredentials) { throw 'La instalación cambió. Volvé a abrir el asistente.' }
    $scManifest=[IO.File]::ReadAllText($ManifestFile) | ConvertFrom-Json
    $scExpected=Join-Path $scDetected.appDir ('versions\'+$scManifest.releaseId)
    if ($scManifest.version -ne $scOptions.version -or (Assert-SCLocalPath $scOptions.releaseDir) -ne $scExpected) { throw 'El paquete no coincide con la carpeta de destino.' }
    $scOld=if ($scDetected.state) { $scDetected.state.releaseDir } else { $null }
    $scResult=Initialize-SCPayload $scOptions.releaseDir $ManifestFile $scOld -Verify:$Verify
    if ($Verify) { Write-Host "Integridad comprobada: $($scResult.verified) archivos." }
    else { Write-Host "Archivos reutilizados: $($scResult.existing+$scResult.linked+$scResult.copied). Archivos nuevos o modificados a extraer: $($scResult.extract)." }
    exit 0
} catch { Write-Host $_.Exception.Message; exit 1 }
