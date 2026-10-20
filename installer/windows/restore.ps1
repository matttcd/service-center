param([Parameter(Mandatory=$true)][string]$DataDir)
$ErrorActionPreference = 'Stop'
$scIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal $scIdentity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell.exe -Verb RunAs -ArgumentList @('-NoExit','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$PSCommandPath+'"'),'-DataDir',('"'+$DataDir+'"'))
    exit
}
$scState = Get-Content -LiteralPath (Join-Path $DataDir 'installation.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$scNode = Join-Path $scState.releaseDir 'runtime/node/node.exe'
$env:SERVICE_CENTER_ENV_FILE = Join-Path $DataDir 'config/service.json'
$scFile = (Read-Host 'Ruta completa del archivo de respaldo cifrado').Trim('"')
if (-not (Test-Path -LiteralPath $scFile -PathType Leaf)) { throw 'No se encontró el respaldo.' }
$scSecureKey = Read-Host 'Clave BACKUP_ENCRYPTION_KEY del equipo que creó la copia (no se mostrará)' -AsSecureString
if ((Read-Host 'Se reemplazarán los datos. Escribí RESTAURAR para continuar') -ne 'RESTAURAR') { exit }
$scBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($scSecureKey)
$scPaused = $false
try {
    $scKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($scBstr)
    $scService = Get-Service -Name ServiceCenterApp -ErrorAction Stop
    if ($scService.Status -eq 'Running') {
        & $scNode (Join-Path $scState.releaseDir 'scripts/windows/service-control.mjs') maintenance
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo activar el mantenimiento.' }
        $scPaused = $true
    } elseif ($scService.Status -ne 'Stopped') { throw 'Esperá a que la aplicación termine de iniciar o detenerse.' }
    $scStart = New-Object Diagnostics.ProcessStartInfo
    $scStart.FileName=$scNode
    $scStart.Arguments='"' + (Join-Path $scState.releaseDir 'server/backup-cli.js') + '" restore-file "' + $scFile + '" --confirm'
    $scStart.UseShellExecute=$false; $scStart.CreateNoWindow=$true; $scStart.RedirectStandardInput=$true
    $scProcess=[Diagnostics.Process]::Start($scStart)
    $scProcess.StandardInput.WriteLine((@{key=$scKey} | ConvertTo-Json -Compress)); $scProcess.StandardInput.Close()
    $scProcess.WaitForExit()
    if ($scProcess.ExitCode -ne 0) { throw 'No se completó la restauración; el estado previo permanece protegido.' }
    Write-Host 'Restauración completada. La instalación conserva su propia clave para las próximas copias. Revisá las impresoras del nuevo equipo.'
    if (-not $scPaused) { Write-Host 'La aplicación continúa detenida. Ejecutá el instalador de una versión conocida para reparar sus servicios y comprobar las migraciones.' }
} finally {
    if ($scPaused) { & $scNode (Join-Path $scState.releaseDir 'scripts/windows/service-control.mjs') resume }
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($scBstr)
    $scKey=$null
}
