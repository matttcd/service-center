param([Parameter(Mandatory=$true)][string]$WorkDir)
$ErrorActionPreference='Stop'
$scRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$WorkDir=[IO.Path]::GetFullPath($WorkDir)
if ([IO.Path]::GetDirectoryName($WorkDir) -ne (Join-Path $scRoot 'tools') -or [IO.Path]::GetFileName($WorkDir) -notlike 'windows-services-*') { throw 'Destino de pruebas inseguro.' }
. (Join-Path $scRoot 'installer/windows/services.ps1')
$scResult=Join-Path $WorkDir 'result.json'
$scSuffix=[Guid]::NewGuid().ToString('N').Substring(0,8)
$scName='SCt'+$scSuffix
$scId='SCVerify'+$scSuffix
$scWrapper=Join-Path $WorkDir ($scId+'.exe')
$scHelper=Join-Path $scRoot 'tools/windows-helper/ServiceCenterPrint/ServiceCenterPrint.exe'
$scPassword='Sc!'+[Guid]::NewGuid().ToString('N')
$scAccount="$env:COMPUTERNAME\$scName"
$scCreated=$false
$scOk=$false
function Invoke-Helper([object]$Request) {
    $scReply=(($Request | ConvertTo-Json -Compress) | & $scHelper) | ConvertFrom-Json
    if (-not $scReply.ok) { throw 'Falló el auxiliar nativo durante la prueba.' }
    return $scReply
}
function Wait-Identity([string]$Version) {
    for ($scTry=0;$scTry -lt 60;$scTry++) {
        if (Test-Path -LiteralPath (Join-Path $WorkDir 'identity.json')) {
            try {
                $scIdentity=Get-Content -LiteralPath (Join-Path $WorkDir 'identity.json') -Raw | ConvertFrom-Json
                if ($scIdentity.version -eq $Version -and $scIdentity.sid -eq $scSid -and $scIdentity.printerSid -eq $scSid -and -not $scIdentity.admin) { return }
            } catch {}
        }
        Start-Sleep -Milliseconds 500
    }
    throw 'El proceso y la impresión no confirmaron la identidad restringida esperada.'
}
try {
    $scPrincipal=New-Object Security.Principal.WindowsPrincipal ([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $scPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'La prueba necesita elevación de Windows.' }
    [IO.File]::WriteAllText($scResult,'{"pending":true}')
    New-LocalUser -Name $scName -Password (ConvertTo-SecureString $scPassword -AsPlainText -Force) -AccountNeverExpires -PasswordNeverExpires | Out-Null
    $scCreated=$true
    $scSid=(Get-LocalUser -Name $scName).SID.Value
    & icacls.exe $WorkDir /grant:r "*${scSid}:(OI)(CI)M" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron preparar los permisos de la prueba.' }
    $null=Invoke-Helper @{action='grant-service-logon';account=$scAccount}
    Copy-Item -LiteralPath (Join-Path $scRoot 'tools/windows-cache/WinSW.exe') -Destination $scWrapper
    foreach ($scVersion in @('1','2')) {
        $scWorker=Join-Path $WorkDir ("worker$scVersion.ps1")
        $scScript=@"
`$reply=('{"action":"printers"}' | & '$($scHelper.Replace("'","''"))') | ConvertFrom-Json
if (-not `$reply.ok) { exit 2 }
`$value=@{sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;printerSid=`$reply.sid;admin=`$reply.admin;version='$scVersion'} | ConvertTo-Json -Compress
[IO.File]::WriteAllText('$($WorkDir.Replace("'","''"))\identity.json',`$value)
while (`$true) { Start-Sleep -Seconds 1 }
"@
        [IO.File]::WriteAllText($scWorker,([char]0xFEFF+$scScript),(New-Object Text.UTF8Encoding $false))
    }
    $scExe=[Security.SecurityElement]::Escape("$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe")
    $scEscaped=[Security.SecurityElement]::Escape($WorkDir)
    $scConfig="<service><id>$scId</id><name>$scId</name><description>Service Center disposable verification</description><executable>$scExe</executable><arguments>-NoProfile -ExecutionPolicy Bypass -File &quot;$scEscaped\worker1.ps1&quot;</arguments><workingdirectory>$scEscaped</workingdirectory><logpath>$scEscaped</logpath><stoptimeout>2sec</stoptimeout></service>"
    Set-SCService $scId $scWrapper $scConfig $scAccount $scSid $scPassword $false
    Start-Service $scId
    (Get-Service $scId).WaitForStatus('Running',[TimeSpan]::FromSeconds(30))
    Assert-SCServiceProcess $scId $scSid
    Wait-Identity '1'
    Stop-Service $scId
    (Get-Service $scId).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30))
    Set-SCService $scId $scWrapper ($scConfig.Replace('worker1.ps1','worker2.ps1')) $scAccount $scSid '' $true
    $scValidation=Invoke-Helper @{action='validate-account';account=$scAccount;password=$scPassword}
    if ($scValidation.admin -or $scValidation.sid -ne $scSid) { throw 'La actualización alteró las credenciales o los permisos.' }
    Start-Service $scId
    (Get-Service $scId).WaitForStatus('Running',[TimeSpan]::FromSeconds(30))
    Assert-SCServiceProcess $scId $scSid
    Wait-Identity '2'
    Remove-Item -LiteralPath (Join-Path $WorkDir 'identity.json')
    Restart-Service $scId
    Wait-Identity '2'
    Stop-Service $scId
    (Get-Service $scId).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30))
    foreach ($scTextFile in Get-ChildItem -LiteralPath $WorkDir -File | Where-Object { $_.Extension -in @('.xml','.log','.json','.ps1') }) {
        if (([IO.File]::ReadAllText($scTextFile.FullName)).Contains($scPassword)) { throw 'Una contraseña apareció en archivos o registros de la prueba.' }
    }
    $scOk=$true
} catch {
    [IO.File]::WriteAllText($scResult,(@{ok=$false;error=$_.Exception.Message} | ConvertTo-Json -Compress))
} finally {
    try {
        $scService=Get-CimInstance Win32_Service -Filter "Name='$scId'"
        if ($scService) {
            if ($scService.PathName.Trim('"') -ne $scWrapper) { throw 'No se retirará un servicio ajeno.' }
            Stop-Service $scId -ErrorAction SilentlyContinue
            (Get-Service $scId).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(30))
            $scDeletion=Invoke-CimMethod -InputObject $scService -MethodName Delete
            if ($scDeletion.ReturnValue -ne 0) { throw 'No se pudo retirar el servicio descartable.' }
        }
        if ($scCreated) { Remove-LocalUser -Name $scName }
    } catch { $scOk=$false; [IO.File]::WriteAllText($scResult,'{"ok":false,"cleanupError":true}') }
    if ($scOk) { [IO.File]::WriteAllText($scResult,'{"ok":true,"installed":true,"updatedWithoutPassword":true,"restarted":true,"identityVerified":true,"cleaned":true}') }
    $scPassword=$null
}
