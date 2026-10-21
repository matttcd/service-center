. (Join-Path $PSScriptRoot 'deployment.ps1')
function Set-SCService([string]$Id,[string]$Wrapper,[string]$Configuration,[string]$Account,[string]$Sid,[string]$Password,[bool]$PreserveCredentials) {
    $scService=Get-CimInstance Win32_Service -Filter "Name='$Id'"
    if ($scService -and $scService.PathName.Trim('"') -ne $Wrapper) { throw "El servicio $Id no pertenece a este programa." }
    if ($PreserveCredentials -and (-not $scService -or (Get-SCAccountSid $scService.StartName) -ne $Sid)) { throw 'La identidad del servicio cambió desde la comprobación previa.' }
    $scXmlFile=[IO.Path]::ChangeExtension($Wrapper,'.xml')
    # WinSW 2.12 no tiene refresh. Lee el XML nuevo al arrancar; el SCM conserva
    # las credenciales. Las contraseñas solo se entregan en memoria a Windows.
    [IO.File]::WriteAllText($scXmlFile,$Configuration,(New-Object Text.UTF8Encoding $false))
    if (-not $scService) {
        & $Wrapper install
        if ($LASTEXITCODE -ne 0) { throw "No se pudo registrar $Id." }
        $scService=Get-CimInstance Win32_Service -Filter "Name='$Id'"
    }
    if (-not $PreserveCredentials) {
        if (-not $Password) { throw 'Se requieren credenciales para registrar o reparar la cuenta.' }
        $scChanged=Invoke-CimMethod -InputObject $scService -MethodName Change -Arguments @{StartName=$Account;StartPassword=$Password}
        if ($scChanged.ReturnValue -ne 0) { throw "Windows rechazó la cuenta del servicio $Id." }
    }
    $scParts=$Account.Split('\',2)
    $scDomain=[Security.SecurityElement]::Escape($scParts[0])
    $scUser=[Security.SecurityElement]::Escape($scParts[1])
    $scFinal=$Configuration.Replace('</service>',"<serviceaccount><domain>$scDomain</domain><user>$scUser</user></serviceaccount></service>")
    [IO.File]::WriteAllText($scXmlFile,$scFinal,(New-Object Text.UTF8Encoding $false))
    $scActualService=Get-CimInstance Win32_Service -Filter "Name='$Id'"
    $scActualSid=Get-SCAccountSid $scActualService.StartName
    if ($scActualSid -ne $Sid) { throw "No se aplicó la identidad esperada para ${Id}: cuenta $($scActualService.StartName), SID $scActualSid, previsto $Sid." }
}
function Assert-SCServiceProcess([string]$Id,[string]$Sid) {
    $scService=Get-CimInstance Win32_Service -Filter "Name='$Id'"
    if ($scService.State -ne 'Running' -or (Get-SCAccountSid $scService.StartName) -ne $Sid) { throw "El servicio $Id no arrancó con su cuenta prevista." }
    $scProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($scService.ProcessId)"
    $scOwner=Invoke-CimMethod -InputObject $scProcess -MethodName GetOwnerSid
    if ($scOwner.ReturnValue -ne 0 -or $scOwner.Sid -ne $Sid -or $Sid -in @('S-1-5-18','S-1-5-19','S-1-5-20')) { throw "Identidad de proceso inesperada para $Id." }
}
