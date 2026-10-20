param([Parameter(Mandatory=$true)][string]$DataDir)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$scPayload=$null
$scPasswordChanged=$false
$scGatewayWasRunning=$false
function Invoke-ResetHelper([string]$Mode) {
    $scStart=New-Object Diagnostics.ProcessStartInfo
    $scStart.FileName=$scNode
    $scStart.Arguments='"' + (Join-Path $scState.releaseDir 'server/admin-recovery-cli.js') + '" ' + $Mode
    $scStart.EnvironmentVariables['SERVICE_CENTER_ENV_FILE']=(Join-Path $DataDir 'config/service.json')
    $scStart.UseShellExecute=$false
    $scStart.CreateNoWindow=$true
    $scStart.RedirectStandardInput=$true
    $scStart.RedirectStandardOutput=$true
    $scStart.RedirectStandardError=$true
    $scProcess=[Diagnostics.Process]::Start($scStart)
    try {
        $scProcess.StandardInput.WriteLine($scPayload)
        $scProcess.StandardInput.Close()
        $scOutputTask=$scProcess.StandardOutput.ReadToEndAsync()
        $scErrorTask=$scProcess.StandardError.ReadToEndAsync()
        if (-not $scProcess.WaitForExit(45000)) { $scProcess.Kill(); throw 'La herramienta no respondió a tiempo.' }
        $scOutput=$scOutputTask.GetAwaiter().GetResult()
        $null=$scErrorTask.GetAwaiter().GetResult()
        if (-not $scOutput) { throw 'No se pudo confirmar el restablecimiento.' }
        return ($scOutput | ConvertFrom-Json)
    } finally { $scProcess.Dispose() }
}
try {
    $scPrincipal=New-Object Security.Principal.WindowsPrincipal ([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $scPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        # Debe ser visible: el usuario necesita interactuar con el diálogo.
        Start-Process powershell.exe -Verb RunAs -WindowStyle Normal -ArgumentList @('-STA','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$PSCommandPath+'"'),'-DataDir',('"'+$DataDir+'"')) | Out-Null
        exit
    }
    $DataDir=[IO.Path]::GetFullPath($DataDir).TrimEnd('\')
    $scState=Get-Content -LiteralPath (Join-Path $DataDir 'installation.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($scState.dataDir -ne $DataDir -or $scState.status -ne 'ready') { throw 'La instalación no está lista.' }
    $scRelease=[IO.Path]::GetFullPath($scState.releaseDir)
    if (-not $scRelease.StartsWith(([IO.Path]::GetFullPath($scState.appDir).TrimEnd('\')+'\versions\'),[StringComparison]::OrdinalIgnoreCase)) { throw 'La versión no pertenece a esta instalación.' }
    $scSettings=Get-Content -LiteralPath (Join-Path $DataDir 'config/service.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($scId in @('ServiceCenterApp','ServiceCenterHttps','ServiceCenterPostgres')) {
        $scService=Get-CimInstance Win32_Service -Filter "Name='$scId'"
        if (-not $scService -or $scService.PathName.IndexOf($scState.appDir.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase) -lt 0) { throw 'Los servicios no corresponden a esta instalación.' }
        if ($scService.State -ne 'Running') { throw 'Los servicios deben estar en ejecución.' }
    }
    $scNode=Join-Path $scRelease 'runtime/node/node.exe'
    $scForm=New-Object Windows.Forms.Form
    $scForm.Text='Service Center - Recuperar Administrador'
    $scForm.ClientSize=New-Object Drawing.Size(500,300)
    $scForm.StartPosition='CenterScreen'
    $scForm.FormBorderStyle='FixedDialog'
    $scForm.MaximizeBox=$false
    $scForm.MinimizeBox=$false
    $scForm.TopMost=$true
    $scForm.Font=New-Object Drawing.Font('Segoe UI',10)
    $scInfo=New-Object Windows.Forms.Label
    $scInfo.Text='Elegí una nueva clave para Administrador. Se cerrarán sus sesiones y se reiniciará brevemente la aplicación.'
    $scInfo.SetBounds(20,15,460,45)
    $scFirstLabel=New-Object Windows.Forms.Label
    $scFirstLabel.Text='Nueva contraseña (mínimo 8 caracteres):'
    $scFirstLabel.SetBounds(20,70,460,22)
    $scFirst=New-Object Windows.Forms.TextBox
    $scFirst.UseSystemPasswordChar=$true
    $scFirst.SetBounds(20,95,460,28)
    $scSecondLabel=New-Object Windows.Forms.Label
    $scSecondLabel.Text='Repetir contraseña:'
    $scSecondLabel.SetBounds(20,132,460,22)
    $scSecond=New-Object Windows.Forms.TextBox
    $scSecond.UseSystemPasswordChar=$true
    $scSecond.SetBounds(20,157,460,28)
    $scShow=New-Object Windows.Forms.CheckBox
    $scShow.Text='Mostrar contraseña'
    $scShow.SetBounds(20,190,240,25)
    $scShow.Add_CheckedChanged({ $scFirst.UseSystemPasswordChar=-not $scShow.Checked; $scSecond.UseSystemPasswordChar=-not $scShow.Checked })
    $scValidation=New-Object Windows.Forms.Label
    $scValidation.ForeColor=[Drawing.Color]::Firebrick
    $scValidation.SetBounds(20,220,460,24)
    $scSave=New-Object Windows.Forms.Button
    $scSave.Text='Restablecer'
    $scSave.SetBounds(245,255,115,30)
    $scSave.Add_Click({
        if ($scFirst.Text.Length -lt 8 -or [Text.Encoding]::UTF8.GetByteCount($scFirst.Text) -gt 72) { $scValidation.Text='Usá al menos 8 caracteres y hasta 72 bytes.'; return }
        if ($scFirst.Text -cne $scSecond.Text) { $scValidation.Text='Las contraseñas no coinciden.'; return }
        if ($scFirst.Text -eq 'admin123') { $scValidation.Text='Elegí una contraseña diferente a la inicial.'; return }
        $scForm.Tag=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($scFirst.Text))
        $scForm.DialogResult=[Windows.Forms.DialogResult]::OK
        $scForm.Close()
    })
    $scCancel=New-Object Windows.Forms.Button
    $scCancel.Text='Cancelar'
    $scCancel.DialogResult=[Windows.Forms.DialogResult]::Cancel
    $scCancel.SetBounds(370,255,110,30)
    $scForm.AcceptButton=$scSave
    $scForm.CancelButton=$scCancel
    $scForm.Controls.AddRange(@($scInfo,$scFirstLabel,$scFirst,$scSecondLabel,$scSecond,$scShow,$scValidation,$scSave,$scCancel))
    $scForm.Add_Shown({ $scForm.Activate(); $scFirst.Focus() })
    if ($scForm.ShowDialog() -ne [Windows.Forms.DialogResult]::OK) { $scForm.Dispose(); exit }
    # Base64 evita problemas de stdin en PowerShell 5.1. Solo pasa por memoria.
    $scPayload=@{passwordBase64=[string]$scForm.Tag} | ConvertTo-Json -Compress
    $scFirst.Clear(); $scSecond.Clear(); $scForm.Tag=$null; $scForm.Dispose()
    $scResponse=Invoke-ResetHelper 'reset'
    $scPasswordChanged=[bool]$scResponse.changed
    # Reinicia también los bloqueos de otras IP del local, no solo de loopback.
    if ($scPasswordChanged) {
        $scGatewayWasRunning=(Get-Service ServiceCenterHttps).Status -eq 'Running'
        if ($scGatewayWasRunning) { Stop-Service ServiceCenterHttps; (Get-Service ServiceCenterHttps).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(45)) }
        Restart-Service ServiceCenterApp
        (Get-Service ServiceCenterApp).WaitForStatus('Running',[TimeSpan]::FromSeconds(45))
        $scHealthy=$false
        for ($scTry=0;$scTry -lt 60;$scTry++) {
            try {
                $scHealth=Invoke-RestMethod ("http://127.0.0.1:$($scSettings.PORT)/api/health") -TimeoutSec 2
                if ($scHealth.status -eq 'ok' -and $scHealth.instance -eq $scSettings.INSTANCE_ID) { $scHealthy=$true; break }
            } catch {}
            Start-Sleep -Seconds 1
        }
        if (-not $scHealthy) { throw 'No se pudo confirmar el acceso después del reinicio.' }
        if ($scGatewayWasRunning) { Start-Service ServiceCenterHttps; $scGatewayWasRunning=$false }
        $scResponse=Invoke-ResetHelper 'verify'
    }
    if (-not $scResponse.ok -or $scResponse.loginStatus -ne 200) { throw 'No se pudo confirmar el acceso con la nueva contraseña.' }
    $scHttpsHealth=Invoke-RestMethod ("https://localhost:$($scState.httpsPort)/api/health") -TimeoutSec 10
    if ($scHttpsHealth.status -ne 'ok' -or $scHttpsHealth.instance -ne $scSettings.INSTANCE_ID) { throw 'No se pudo confirmar el acceso HTTPS.' }
    [Windows.Forms.MessageBox]::Show('Contraseña restablecida y acceso comprobado. Volvé al navegador, seleccioná Administrador y usá la nueva contraseña.','Service Center',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Information) | Out-Null
} catch {
    $scMessage=if ($scPasswordChanged) { 'La contraseña cambió, pero no se pudo comprobar el acceso. Conservá la nueva contraseña y revisá los servicios y registros antes de repetir.' } else { 'No se pudo completar la recuperación. Comprobá los permisos de administrador de Windows y que los servicios de Service Center estén en ejecución. Si hubo un corte o una espera agotada, probá la nueva contraseña antes de repetir.' }
    [Windows.Forms.MessageBox]::Show($scMessage,'Service Center',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Error) | Out-Null
} finally {
    $scPayload=$null
    if ($scGatewayWasRunning -and (Get-Service ServiceCenterHttps).Status -eq 'Stopped') { Start-Service ServiceCenterHttps -ErrorAction SilentlyContinue }
}
