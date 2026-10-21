param([string]$AppDir,[string]$DataDir,[Parameter(Mandatory=$true)][string]$Version,[Parameter(Mandatory=$true)][string]$OutputFile)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'deployment.ps1')
try {
    $scInfo=Get-SCDeployment $AppDir $DataDir $Version
    $scLines=@('[deployment]')
    foreach ($scKey in @('operation','currentVersion','appDir','dataDir','hostName','httpsPort','serviceAccount','preserveServiceCredentials','credentialRequired','needsInitialPassword')) {
        $scValue=[string]$scInfo.$scKey
        if ($scValue -match '[\r\n]') { throw 'Metadatos inválidos.' }
        $scLines+="$scKey=$scValue"
    }
    [IO.File]::WriteAllLines($OutputFile,$scLines,[Text.Encoding]::Unicode)
    exit 0
} catch { Write-Host $_.Exception.Message; exit 1 }
