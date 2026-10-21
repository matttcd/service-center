param([Parameter(Mandatory=$true)][string]$WorkDir)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../../installer/windows/deployment.ps1')
function Assert([bool]$Condition,[string]$Message) { if (-not $Condition) { throw $Message } }
function Must-Fail([scriptblock]$Action) { $scFailed=$false; try { & $Action | Out-Null } catch { $scFailed=$true }; Assert $scFailed 'Se aceptaron metadatos inseguros.' }
$scCurrentIdentity=[Security.Principal.WindowsIdentity]::GetCurrent()
if ($scCurrentIdentity.Name.StartsWith($env:COMPUTERNAME+'\',[StringComparison]::OrdinalIgnoreCase)) {
    $scLocalAlias='.'+$scCurrentIdentity.Name.Substring($env:COMPUTERNAME.Length)
    Assert ((Get-SCAccountSid $scLocalAlias) -eq $scCurrentIdentity.User.Value) 'No se reconoce la cuenta local abreviada que devuelve Windows.'
}
$scApp=Join-Path $WorkDir 'program'
$scData=Join-Path $WorkDir 'data'
$scRelease=Join-Path $scApp 'versions/1.1.1-fixture'
$scSid='S-1-5-21-100-200-300-1001'
$scAccount="$env:COMPUTERNAME\ServiceCenterSvc"
$script:scRegistry=$null
$script:scServices=@{}
function Get-ItemProperty { return $script:scRegistry }
function Get-CimInstance { param($ClassName,$Filter) $scId=$Filter.Split("'")[1]; return $script:scServices[$scId] }
function Get-SCAccountSid([string]$Account) { if ($Account -eq 'LocalSystem') { return 'S-1-5-18' }; if ($Account) { return 'S-1-5-21-100-200-300-1001' }; return $null }
function Save-State { $scState | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $scData 'installation.json') -Encoding UTF8 }
Assert ((Get-SCDeployment $scApp $scData '1.1.4').operation -eq 'install') 'No se detectó una instalación nueva.'
New-Item -ItemType Directory -Path $scRelease,(Join-Path $scData 'config') -Force | Out-Null
$script:scRegistry=[pscustomobject]@{AppDir=$scApp;DataDir=$scData}
$scState=@{appDir=$scApp;dataDir=$scData;releaseDir=$scRelease;version='1.1.1';status='ready';hostName='TALLER';httpsPort='444';serviceAccount=$scAccount;serviceSid=$scSid}
Save-State
@{version='1.1.1';releaseId='1.1.1-fixture';platform='win32-x64'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $scRelease 'manifest.json') -Encoding UTF8
'{}' | Set-Content -LiteralPath (Join-Path $scData 'config/service.json')
foreach ($scId in @('ServiceCenterApp','ServiceCenterHttps','ServiceCenterPostgres')) { $script:scServices[$scId]=[pscustomobject]@{StartName=$scAccount;PathName=('"'+(Join-Path $scApp "services/$scId.exe")+'"')} }
$scDetected=Get-SCDeployment $scApp $scData '1.1.4'
Assert ($scDetected.operation -eq 'update' -and $scDetected.preserveServiceCredentials -and -not $scDetected.credentialRequired -and -not $scDetected.needsInitialPassword) 'La actualización automática pide credenciales o cambia de modo.'
Assert ($scDetected.hostName -eq 'TALLER' -and $scDetected.httpsPort -eq '444') 'Se perdieron opciones de red.'
Assert ((Get-SCDeployment $scApp $scData '1.1.1').operation -eq 'repair') 'Misma versión debe reparar.'
Must-Fail { Get-SCDeployment $scApp $scData '1.1.0' }
$scState.serviceAccount='DOMINIO\impresion'; Save-State
$script:scServices.ServiceCenterApp.StartName='DOMINIO\impresion'
$script:scServices.ServiceCenterHttps.StartName='DOMINIO\impresion'
$scDetected=Get-SCDeployment $scApp $scData '1.1.4'
Assert ($scDetected.preserveServiceCredentials -and -not $scDetected.credentialRequired -and $scDetected.serviceAccount -eq 'DOMINIO\impresion') 'La actualización personalizada exige contraseña.'
$script:scServices.ServiceCenterApp.StartName='LocalSystem'
Assert ((Get-SCDeployment $scApp $scData '1.1.4').credentialRequired) 'La reparación de una cuenta personalizada requiere autenticación.'
$scState.serviceAccount=$scAccount; $scState.status='installing'; Save-State
$scDetected=Get-SCDeployment $scApp $scData '1.1.4'
Assert ($scDetected.operation -eq 'repair' -and -not $scDetected.preserveServiceCredentials -and -not $scDetected.credentialRequired) 'La instalación interrumpida no se repara automáticamente.'
$script:scServices.ServiceCenterApp.PathName='"C:\ajeno\otro.exe"'
Must-Fail { Get-SCDeployment $scApp $scData '1.1.4' }
$script:scServices=@{}
$scState.status='uninstalled'; Save-State
Remove-Item -LiteralPath (Join-Path $scRelease 'manifest.json')
Assert ((Get-SCDeployment $scApp $scData '1.1.4').operation -eq 'reinstall') 'No se detectaron los datos conservados después de desinstalar.'
$scState.dataDir=Join-Path $WorkDir 'foreign'; Save-State
Must-Fail { Get-SCDeployment $scApp $scData '1.1.4' }
Write-Host 'OK: nueva instalación, actualización sin credenciales, reparación, interrupción, reinstalación y rechazo de versiones/rutas ajenas.'
