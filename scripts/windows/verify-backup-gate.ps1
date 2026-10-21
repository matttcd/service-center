param([Parameter(Mandatory=$true)][string]$WorkDir,[Parameter(Mandatory=$true)][string]$NodeExe)
$ErrorActionPreference='Stop'
$scRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$scApp=Join-Path $WorkDir 'program'
$scData=Join-Path $WorkDir 'data'
$scOld=Join-Path $scApp 'versions/1.1.1-old'
$scNew=Join-Path $scApp 'versions/1.1.4-new'
New-Item -ItemType Directory -Path (Join-Path $scOld 'runtime/node'),(Join-Path $scOld 'scripts/windows'),(Join-Path $scNew 'runtime/node'),(Join-Path $scNew 'server'),(Join-Path $scData 'config'),(Join-Path $scData 'postgres') -Force | Out-Null
Copy-Item -LiteralPath $NodeExe -Destination (Join-Path $scOld 'runtime/node/node.exe')
Copy-Item -LiteralPath $NodeExe -Destination (Join-Path $scNew 'runtime/node/node.exe')
'process.exit(0)' | Set-Content -LiteralPath (Join-Path $scOld 'scripts/windows/service-control.mjs')
'process.exit(23)' | Set-Content -LiteralPath (Join-Path $scNew 'server/backup-before-update.js')
$scAccount=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$scSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
@{version='1.1.1';platform='win32-x64';releaseId='1.1.1-old'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $scOld 'manifest.json') -Encoding UTF8
@{version='1.1.1';status='ready';appDir=$scApp;dataDir=$scData;releaseDir=$scOld;hostName='TALLER';httpsPort='443';serviceAccount=$scAccount;serviceSid=$scSid} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $scData 'installation.json') -Encoding UTF8
'{"preserve":"fixture"}' | Set-Content -LiteralPath (Join-Path $scData 'config/service.json')
'16' | Set-Content -LiteralPath (Join-Path $scData 'postgres/PG_VERSION')
$scBefore=[IO.File]::ReadAllText((Join-Path $scData 'installation.json'))
$scOptions=Join-Path $WorkDir 'options.json'
@{version='1.1.4';appDir=$scApp;dataDir=$scData;releaseDir=$scNew;hostName='TALLER';httpsPort='443';serviceAccount=$scAccount;servicePassword='';operation='update';preserveServiceCredentials='True'} | ConvertTo-Json | Set-Content -LiteralPath $scOptions -Encoding UTF8
$script:scMutation=$false
function Get-ItemProperty { [pscustomobject]@{AppDir=$scApp;DataDir=$scData} }
function Get-CimInstance { param($ClassName,$Filter) [pscustomobject]@{StartName=$scAccount;State='Running';PathName=('"'+(Join-Path $scApp 'services/owned.exe')+'"')} }
function Get-Service { [pscustomobject]@{Status='Running'} }
function Stop-Service { $script:scMutation=$true; throw 'No se deben detener servicios si falla el respaldo.' }
function New-LocalUser { $script:scMutation=$true; throw 'No se deben crear cuentas si falla el respaldo.' }
function Set-LocalUser { $script:scMutation=$true; throw 'No se deben modificar cuentas si falla el respaldo.' }
function Invoke-CimMethod { $script:scMutation=$true; throw 'No se deben modificar servicios si falla el respaldo.' }
$scRejected=$false
try { & (Join-Path $scRepo 'installer/windows/install.ps1') -OptionsFile $scOptions; if ($LASTEXITCODE -ne 0) { $scRejected=$true } } catch { $scRejected=$true }
if (-not $scRejected -or $script:scMutation -or [IO.File]::ReadAllText((Join-Path $scData 'installation.json')) -ne $scBefore) { throw 'La actualización no se detuvo de forma segura ante el fallo del respaldo.' }
Write-Host 'OK: el fallo de respaldo bloquea cambios de cuentas, servicios y estado.'
