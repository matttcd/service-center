param([Parameter(Mandatory=$true)][string]$OptionsFile)
$ErrorActionPreference = 'Stop'
$OutputEncoding = New-Object Text.UTF8Encoding $false
$scOptions = [IO.File]::ReadAllText($OptionsFile) | ConvertFrom-Json
$scApp = [IO.Path]::GetFullPath($scOptions.appDir)
$scRelease = [IO.Path]::GetFullPath($scOptions.releaseDir)
$scData = [IO.Path]::GetFullPath($scOptions.dataDir)
$scStateFile = Join-Path $scData 'installation.json'
$scEnvFile = Join-Path $scData 'config/service.json'
$scNode = Join-Path $scRelease 'runtime/node/node.exe'
$scPgBin = Join-Path $scRelease 'runtime/pgsql/bin'
$scServices = Join-Path $scApp 'services'
$scAdminSid = '*S-1-5-32-544'
$scSystemSid = '*S-1-5-18'
$scNetworkSid = '*S-1-5-20'
$scUserName = 'ServiceCenterSvc'
$scUser = "$env:COMPUTERNAME\$scUserName"
$scManaged = -not [bool]$scOptions.serviceAccount
if (-not $scManaged) { $scUser = [string]$scOptions.serviceAccount }
$scExisting = $null
$scChanged = $false
$scReadyExisting = $false

function Invoke-Checked([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Falló $([IO.Path]::GetFileName($File)). Revisá los registros de instalación." }
}
function Write-Utf8([string]$File, [string]$Text) { [IO.File]::WriteAllText($File, $Text, (New-Object Text.UTF8Encoding $false)) }
function New-Secret { $scBytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($scBytes); return ([BitConverter]::ToString($scBytes)).Replace('-','').ToLower() }
function Set-Private([string]$Path, [string]$Account) {
    Invoke-Checked 'icacls.exe' @($Path, '/inheritance:r', '/grant:r', "${scAdminSid}:(OI)(CI)F", "${scSystemSid}:(OI)(CI)F", "${Account}:(OI)(CI)M")
}
function Service-Xml([string]$Id, [string]$Executable, [string]$Arguments, [string]$Dependency, [string]$StopArguments) {
    $scEscape = { param($text) [Security.SecurityElement]::Escape($text) }
    $scArgTag = if ($StopArguments) { 'startarguments' } else { 'arguments' }
    $scXml = "<service><id>$Id</id><name>$Id</name><description>Service Center</description><executable>$(& $scEscape $Executable)</executable><$scArgTag>$(& $scEscape $Arguments)</$scArgTag><workingdirectory>$(& $scEscape $scRelease)</workingdirectory><startmode>Automatic</startmode><delayedAutoStart>true</delayedAutoStart><depend>$Dependency</depend><onfailure action=`"restart`" delay=`"10 sec`"/><onfailure action=`"restart`" delay=`"30 sec`"/><resetfailure>1 hour</resetfailure><stoptimeout>45 sec</stoptimeout><logpath>$(& $scEscape (Join-Path $scData 'logs'))</logpath><log mode=`"roll-by-size`"><sizeThreshold>10240</sizeThreshold><keepFiles>5</keepFiles></log><env name=`"SERVICE_CENTER_ENV_FILE`" value=`"$(& $scEscape $scEnvFile)`"/>"
    if ($StopArguments) { $scXml += "<stopexecutable>$(& $scEscape $scNode)</stopexecutable><stoparguments>$(& $scEscape $StopArguments)</stoparguments>" }
    return $scXml + '</service>'
}
try {
    if (-not (Test-Path -LiteralPath $scEnvFile)) {
        $scInitialPassword = [string]$scOptions.adminPassword
        if ($scInitialPassword.Length -lt 8 -or [Text.Encoding]::UTF8.GetByteCount($scInitialPassword) -gt 72 -or $scInitialPassword -match '[\r\n\x00]') { throw 'La contraseña inicial requiere 8 caracteres como mínimo y hasta 72 bytes.' }
    }
    if ($scData -notmatch '^[a-zA-Z]:\\.+' -or $scData.StartsWith($scApp.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -or $scData -eq $scApp) { throw 'La carpeta de datos debe estar en un disco local y fuera de la carpeta del programa.' }
    if ($scOptions.hostName -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$') { throw 'Nombre o IP del servidor inválido.' }
    $scHttpsPort = [int]$scOptions.httpsPort
    if ($scHttpsPort -lt 1 -or $scHttpsPort -gt 65535) { throw 'Puerto HTTPS inválido.' }
    if (-not $scManaged) {
        if ($scUser -notmatch '^[^\\\r\n]+\\[^\\\r\n]+$' -or -not $scOptions.servicePassword) { throw 'Ingresá una cuenta Windows DOMINIO\usuario y su contraseña.' }
        $scRequest = @{action='validate-account';account=$scUser;password=$scOptions.servicePassword} | ConvertTo-Json -Compress
        $scValidation = ($scRequest | & (Join-Path $scRelease 'runtime/printer/ServiceCenterPrint.exe')) | ConvertFrom-Json
        if (-not $scValidation.ok -or $scValidation.admin) { throw 'La cuenta de impresión debe ser válida y no pertenecer a Administradores.' }
    }
    if (Test-Path -LiteralPath $scStateFile) {
        $scExisting = Get-Content -LiteralPath $scStateFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($scExisting.dataDir -ne $scData -or $scExisting.appDir -ne $scApp) { throw 'La instalación existente usa otra ruta. No se cambiarán sus datos.' }
        if ($scExisting.serviceAccount -ne $scUser) { throw 'Para actualizar, usá la misma cuenta del servicio que en la instalación anterior.' }
        $scReadyExisting = $scExisting.status -eq 'ready'
        $scOldNode = Join-Path $scExisting.releaseDir 'runtime/node/node.exe'
        $env:SERVICE_CENTER_ENV_FILE = $scEnvFile
      if ($scReadyExisting -and (Get-Service ServiceCenterApp -ErrorAction SilentlyContinue).Status -eq 'Running') {
        Invoke-Checked $scOldNode @((Join-Path $scExisting.releaseDir 'scripts/windows/service-control.mjs'), 'maintenance')
        # El control confirma que terminaron las mutaciones ya admitidas.
        $scBackupOutput = & $scOldNode (Join-Path $scExisting.releaseDir 'server/backup-cli.js') create
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la copia previa. Actualización cancelada.' }
        $scBackup = ($scBackupOutput | Select-Object -Last 1) | ConvertFrom-Json
        if (-not $scBackup.name) { throw 'No se confirmó la copia previa. Actualización cancelada.' }
        Write-Host "Respaldo previo: $($scBackup.name)"
      } elseif ($scReadyExisting) {
        # También exige respaldo si se actualiza con la aplicación detenida.
        $scBackupOutput = & $scOldNode (Join-Path $scExisting.releaseDir 'server/backup-cli.js') create
        if ($LASTEXITCODE -ne 0 -or -not (($scBackupOutput | Select-Object -Last 1) | ConvertFrom-Json).name) { throw 'No se pudo crear el respaldo previo. Actualización cancelada.' }
      }
    } else {
        if ((Test-Path -LiteralPath $scData) -and (Get-ChildItem -LiteralPath $scData -Force | Select-Object -First 1)) { throw 'La carpeta de datos ya contiene archivos ajenos a una instalación reconocida. Elegí una carpeta nueva.' }
        foreach ($scPort in @(5436,4011,$scHttpsPort)) {
            if (Get-NetTCPConnection -LocalPort $scPort -State Listen -ErrorAction SilentlyContinue) { throw "El puerto $scPort está ocupado. No se modificarán otros servicios." }
        }
        if ($scManaged -and (Get-LocalUser -Name $scUserName -ErrorAction SilentlyContinue)) { throw 'Ya existe ServiceCenterSvc sin una instalación reconocida. Revisar antes de continuar.' }
        foreach ($scId in @('ServiceCenterPostgres','ServiceCenterApp','ServiceCenterHttps')) {
            if (Get-Service -Name $scId -ErrorAction SilentlyContinue) { throw "Ya existe $scId sin una instalación reconocida." }
        }
    }
    foreach ($scId in @('ServiceCenterHttps','ServiceCenterApp')) {
        $scService = Get-Service -Name $scId -ErrorAction SilentlyContinue
        if ($scService -and $scService.Status -ne 'Stopped') { Stop-Service -Name $scId; $scService.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60)) }
    }
    $scChanged = $true
    foreach ($scDir in @($scData, $scServices, (Join-Path $scData 'config'), (Join-Path $scData 'logs'), (Join-Path $scData 'tmp'), (Join-Path $scData 'tls'), (Join-Path $scData 'backups-exported'))) { New-Item -ItemType Directory -Path $scDir -Force | Out-Null }
    $scPassword = 'Sc!' + (New-Secret)
    if (-not $scManaged) {
        $scPassword = [string]$scOptions.servicePassword
        $scSid = $scValidation.sid
    } elseif (-not $scExisting) {
        New-LocalUser -Name $scUserName -Password (ConvertTo-SecureString $scPassword -AsPlainText -Force) -AccountNeverExpires -PasswordNeverExpires -Description 'Servicio de órdenes y colas de impresión' | Out-Null
        $scSid = (Get-LocalUser -Name $scUserName).SID.Value
    } else {
        $scAccount = Get-LocalUser -Name $scUserName
        if ($scAccount.SID.Value -ne $scExisting.serviceSid) { throw 'La identidad de la cuenta del servicio cambió. Instalación cancelada.' }
        Set-LocalUser -Name $scUserName -Password (ConvertTo-SecureString $scPassword -AsPlainText -Force)
        $scSid = $scAccount.SID.Value
    }
    Set-Private $scData $scUser
    Start-Transcript -Path (Join-Path $scData 'logs/installation.log') -Append | Out-Null
    # Guarda el progreso para poder reparar una instalación interrumpida.
    $scPendingState = @{ status='installing'; version=$scOptions.version; appDir=$scApp; dataDir=$scData; releaseDir=$scRelease; serviceSid=$scSid; serviceAccount=$scUser; hostName=$scOptions.hostName; httpsPort=$scHttpsPort; safetyBackup=$scBackup.name }
    Write-Utf8 $scStateFile (ConvertTo-Json $scPendingState)
    # Lectura del programa; la cuenta no puede modificar sus ejecutables.
    Invoke-Checked 'icacls.exe' @($scApp, '/inheritance:r','/grant:r',"${scAdminSid}:(OI)(CI)F","${scSystemSid}:(OI)(CI)F",'*S-1-5-32-545:(OI)(CI)RX',"${scUser}:(OI)(CI)RX")
    Invoke-Checked 'icacls.exe' @($scApp, '/grant:r', "${scNetworkSid}:(OI)(CI)RX")
    if (-not (Test-Path -LiteralPath $scEnvFile)) {
        $scPgPassword = New-Secret
        $scPgAdminPassword = New-Secret
        $scInitialPassword = [string]$scOptions.adminPassword
        if ($scInitialPassword.Length -lt 8 -or [Text.Encoding]::UTF8.GetByteCount($scInitialPassword) -gt 72 -or $scInitialPassword -match '[\r\n\x00]') { throw 'La contraseña inicial requiere 8 caracteres como mínimo y hasta 72 bytes.' }
        $scEnv = @{
            NODE_ENV='production'; HOST='127.0.0.1'; PORT='4011'; TZ='America/Argentina/Buenos_Aires';
            DATABASE_URL="postgresql://service_center:${scPgPassword}@127.0.0.1:5436/service_center";
            JWT_SECRET=(New-Secret); BACKUP_ENCRYPTION_KEY=(New-Secret); INITIAL_ADMIN_PASSWORD=$scInitialPassword;
            DATA_DIR=(Join-Path $scData 'app-data'); BACKUP_EXPORT_DIR=(Join-Path $scData 'backups-exported');
            PRINT_TRANSPORT='windows'; PRINT_TEMP_DIR=(Join-Path $scData 'tmp');
            BROWSER_DATA_DIR=(Join-Path $scData 'browser'); TEMP=(Join-Path $scData 'tmp'); TMP=(Join-Path $scData 'tmp');
            INSTANCE_ID=(New-Secret);
            SERVICE_CONTROL_TOKEN=(New-Secret); SERVICE_CONTROL_PIPE='\\.\pipe\ServiceCenterControl'
        }
        Write-Utf8 $scEnvFile (ConvertTo-Json $scEnv)
        Write-Utf8 (Join-Path $scData 'config/postgres-admin.env') ('PGPASSWORD=' + $scPgAdminPassword)
        Invoke-Checked 'icacls.exe' @((Join-Path $scData 'config/postgres-admin.env'), '/inheritance:r','/grant:r',"${scAdminSid}:F","${scSystemSid}:F")
    }
    if (-not $scReadyExisting) {
        $scStoredEnv = Get-Content -LiteralPath $scEnvFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $scPgPassword = ([uri]$scStoredEnv.DATABASE_URL).UserInfo.Split(':')[1]
        $scPgAdminPassword = ([IO.File]::ReadAllText((Join-Path $scData 'config/postgres-admin.env'))).Substring(11)
        $scPgData = Join-Path $scData 'postgres'
        New-Item -ItemType Directory -Path $scPgData -Force | Out-Null
        Set-Private $scPgData $scNetworkSid
        $scPwFile = Join-Path $scData 'config/pg-init-password'
        # initdb reduce el token administrativo en Windows. Otorga acceso temporal
        # al SID personal del instalador, sin abrir la base a Users/Everyone.
        $scInstallerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        try {
            Write-Utf8 $scPwFile $scPgAdminPassword
            Invoke-Checked 'icacls.exe' @($scPwFile,'/inheritance:r','/grant:r',"${scAdminSid}:F","${scSystemSid}:F","*${scInstallerSid}:R")
            Invoke-Checked 'icacls.exe' @($scPgData,'/grant:r',"*${scInstallerSid}:(OI)(CI)F")
            if (-not (Test-Path -LiteralPath (Join-Path $scPgData 'PG_VERSION'))) { Invoke-Checked (Join-Path $scPgBin 'initdb.exe') @('-D',$scPgData,'-U','sc_admin','--encoding=UTF8','--locale=C','--auth=scram-sha-256',"--pwfile=$scPwFile") }
        } finally {
            if ($scInstallerSid -notin @('S-1-5-18','S-1-5-20')) { Invoke-Checked 'icacls.exe' @($scPgData,'/remove:g',"*$scInstallerSid",'/T','/Q') }
            if (Test-Path -LiteralPath $scPwFile) { Remove-Item -LiteralPath $scPwFile -Force }
        }
        Add-Content -LiteralPath (Join-Path $scPgData 'postgresql.conf') -Value "`nlisten_addresses='127.0.0.1'`nport=5436`nlogging_collector=on`nlog_directory='log'`nlog_rotation_age='1d'`nlog_truncate_on_rotation=on`nlog_filename='postgresql-%a.log'"
        if (-not (Get-Service ServiceCenterPostgres -ErrorAction SilentlyContinue)) { Invoke-Checked (Join-Path $scPgBin 'pg_ctl.exe') @('register','-D',$scPgData,'-N','ServiceCenterPostgres','-U','NT AUTHORITY\NetworkService','-S','auto') }
        Invoke-Checked 'sc.exe' @('failure','ServiceCenterPostgres','reset=','3600','actions=','restart/10000/restart/30000')
        Start-Service -Name ServiceCenterPostgres
        $scPgReady = $false
        for ($scTry=0; $scTry -lt 60; $scTry++) {
            & (Join-Path $scPgBin 'pg_isready.exe') -h 127.0.0.1 -p 5436 -q
            if ($LASTEXITCODE -eq 0) { $scPgReady=$true; break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $scPgReady) { throw 'PostgreSQL no está disponible. Revisá sus registros.' }
        $env:PGPASSWORD = $scPgAdminPassword
        $scRoleExists = & (Join-Path $scPgBin 'psql.exe') -h 127.0.0.1 -p 5436 -U sc_admin -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='service_center'"
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo acceder al cluster de PostgreSQL.' }
        if ($scRoleExists -ne '1') { "CREATE ROLE service_center LOGIN PASSWORD '$scPgPassword';" | & (Join-Path $scPgBin 'psql.exe') -h 127.0.0.1 -p 5436 -U sc_admin -d postgres -v ON_ERROR_STOP=1; if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el usuario de base de datos.' } }
        $scDbExists = & (Join-Path $scPgBin 'psql.exe') -h 127.0.0.1 -p 5436 -U sc_admin -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='service_center'"
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar la base.' }
        if ($scDbExists -ne '1') { Invoke-Checked (Join-Path $scPgBin 'createdb.exe') @('-h','127.0.0.1','-p','5436','-U','sc_admin','-O','service_center','service_center') }
        $env:PGPASSWORD = $null
    }
    # Solo cambian rutas de runtimes; las claves y opciones existentes se conservan.
    $scRuntimeEnv = @{
        PG_BIN_DIR=$scPgBin; PUPPETEER_EXECUTABLE_PATH=(Join-Path $scRelease 'runtime/chromium/chrome-headless-shell.exe');
        WINDOWS_PRINT_HELPER=(Join-Path $scRelease 'runtime/printer/ServiceCenterPrint.exe');
        SUMATRA_PDF=(Join-Path $scRelease 'runtime/sumatra/SumatraPDF.exe'); APP_VERSION=[string]$scOptions.version
    }
    $scValues = Get-Content -LiteralPath $scEnvFile -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($scKey in $scRuntimeEnv.Keys) {
        $scValues | Add-Member -NotePropertyName $scKey -NotePropertyValue ([string]$scRuntimeEnv[$scKey]) -Force
    }
    Write-Utf8 $scEnvFile (ConvertTo-Json $scValues)
    Invoke-Checked 'icacls.exe' @((Join-Path $scData 'config'),'/inheritance:r','/grant:r',"${scAdminSid}:(OI)(CI)F","${scSystemSid}:(OI)(CI)F","${scUser}:(OI)(CI)RX")
    if ($scExisting -and -not $scReadyExisting) {
        $env:SERVICE_CENTER_ENV_FILE = $scEnvFile
        Invoke-Checked $scNode @((Join-Path $scRelease 'server/backup-cli.js'),'create')
    }
    # El servicio escribe solo en sus carpetas operativas. La raíz no concede
    # DeleteChild: tampoco puede reemplazar config/ o postgres/ desde su padre.
    foreach ($scWritable in @('app-data','backups-exported','logs','tmp','tls','browser')) {
        $scWritablePath = Join-Path $scData $scWritable
        New-Item -ItemType Directory -Path $scWritablePath -Force | Out-Null
        Set-Private $scWritablePath $scUser
    }
    Invoke-Checked 'icacls.exe' @($scData,'/inheritance:r','/grant:r',"${scAdminSid}:(OI)(CI)F","${scSystemSid}:(OI)(CI)F","${scUser}:RX")
    $scTlsPath = (Join-Path $scData 'tls').Replace('\','/')
    $scHosts = (@('localhost','127.0.0.1',$scOptions.hostName) | Select-Object -Unique | ForEach-Object { "https://${_}:$scHttpsPort" }) -join ', '
    $scCaddy = "{`n admin off`n persist_config off`n auto_https disable_redirects`n skip_install_trust`n storage file_system `"$scTlsPath`"`n}`n$scHosts {`n tls internal`n reverse_proxy 127.0.0.1:4011`n}`n"
    $scCaddyFile = Join-Path $scData 'config/Caddyfile'
    Write-Utf8 $scCaddyFile $scCaddy
    $scAppArgs = '"' + (Join-Path $scRelease 'server/start-production.js') + '"'
    $scStopArgs = '"' + (Join-Path $scRelease 'scripts/windows/service-control.mjs') + '" shutdown'
    $scConfigs = @{
        ServiceCenterApp=(Service-Xml 'ServiceCenterApp' $scNode $scAppArgs 'ServiceCenterPostgres' $scStopArgs);
        ServiceCenterHttps=(Service-Xml 'ServiceCenterHttps' (Join-Path $scRelease 'runtime/caddy/caddy.exe') ('run --config "' + $scCaddyFile + '" --adapter caddyfile') 'ServiceCenterApp' '')
    }
    foreach ($scId in $scConfigs.Keys) {
        $scServiceExe = Join-Path $scServices ($scId + '.exe')
        if (-not (Test-Path -LiteralPath $scServiceExe)) { Copy-Item -LiteralPath (Join-Path $scRelease 'runtime/WinSW.exe') -Destination $scServiceExe }
        $scXmlFile = Join-Path $scServices ($scId + '.xml')
        # WinSW entrega la contraseña al SCM; se retira del XML después.
        $scXmlUser = [Security.SecurityElement]::Escape($scUser)
        $scXmlPassword = [Security.SecurityElement]::Escape($scPassword)
        $scXml = $scConfigs[$scId].Replace('</service>', "<serviceaccount><username>$scXmlUser</username><password>$scXmlPassword</password><allowservicelogon>true</allowservicelogon></serviceaccount></service>")
        Write-Utf8 $scXmlFile $scXml
        Invoke-Checked 'icacls.exe' @($scXmlFile,'/inheritance:r','/grant:r',"${scAdminSid}:F","${scSystemSid}:F","${scUser}:R")
        try {
            if (Get-Service -Name $scId -ErrorAction SilentlyContinue) {
                Invoke-Checked $scServiceExe @('refresh')
                $scChange = Invoke-CimMethod -InputObject (Get-CimInstance Win32_Service -Filter "Name='$scId'") -MethodName Change -Arguments @{StartName=$scUser;StartPassword=$scPassword}
                if ($scChange.ReturnValue -ne 0) { throw 'No se pudo actualizar la cuenta del servicio.' }
            } else { Invoke-Checked $scServiceExe @('install') }
        } finally { Write-Utf8 $scXmlFile $scConfigs[$scId] }
    }
    $scChanged = $true
    Start-Service -Name ServiceCenterApp
    $scHealthy = $false
    for ($scTry=0; $scTry -lt 120; $scTry++) {
        try { $scHealth = Invoke-RestMethod 'http://127.0.0.1:4011/api/health' -TimeoutSec 2; if ($scHealth.status -eq 'ok' -and $scHealth.instance -eq $scValues.INSTANCE_ID -and $scHealth.version -eq $scOptions.version) { $scHealthy=$true; break } } catch {}
        Start-Sleep -Seconds 1
    }
    if (-not $scHealthy) { throw 'La aplicación no arrancó. Se conservó el respaldo; revisar los logs antes de continuar.' }
    $env:SERVICE_CENTER_ENV_FILE = $scEnvFile
    $scPrinterOutput = & $scNode (Join-Path $scRelease 'scripts/windows/service-control.mjs') printers
    if ($LASTEXITCODE -ne 0) { throw 'El componente de impresión no funciona con la cuenta del servicio. Revisá los permisos y el servicio Spooler.' }
    $scPrinterState = ($scPrinterOutput | Select-Object -Last 1) | ConvertFrom-Json
    Write-Host "Cuenta de impresión verificada: $($scPrinterState.account). Colas accesibles: $($scPrinterState.printers.Count)."
    Start-Service -Name ServiceCenterHttps
    $scCertificate = Join-Path $scData 'tls/pki/authorities/local/root.crt'
    for ($scTry=0; $scTry -lt 30 -and -not (Test-Path -LiteralPath $scCertificate); $scTry++) { Start-Sleep -Seconds 1 }
    if (-not (Test-Path -LiteralPath $scCertificate)) { throw 'No se generó el certificado HTTPS local.' }
    New-Item -ItemType Directory -Path (Join-Path $scData 'public') -Force | Out-Null
    Copy-Item -LiteralPath $scCertificate -Destination (Join-Path $scData 'public/service-center-root.crt') -Force
    Import-Certificate -FilePath $scCertificate -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
    Invoke-Checked 'icacls.exe' @((Join-Path $scData 'public'),'/grant:r','*S-1-5-32-545:(OI)(CI)RX')
    if (-not (Get-NetFirewallRule -Name 'ServiceCenterHttps' -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -Name 'ServiceCenterHttps' -DisplayName 'Service Center HTTPS - red privada' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $scHttpsPort -Program (Join-Path $scRelease 'runtime/caddy/caddy.exe') -Profile Private -RemoteAddress LocalSubnet | Out-Null
    } else { Set-NetFirewallRule -Name 'ServiceCenterHttps' -Program (Join-Path $scRelease 'runtime/caddy/caddy.exe') -LocalPort $scHttpsPort | Out-Null }
    if ((Invoke-RestMethod "https://localhost:$scHttpsPort/api/health" -TimeoutSec 10).status -ne 'ok') { throw 'Falló la comprobación HTTPS.' }
    $scState = @{ status='ready'; version=$scOptions.version; appDir=$scApp; dataDir=$scData; releaseDir=$scRelease; serviceSid=$scSid; serviceAccount=$scUser; hostName=$scOptions.hostName; httpsPort=$scHttpsPort }
    Write-Utf8 $scStateFile (ConvertTo-Json $scState)
    Write-Host "Sistema instalado. Abrí https://$($scOptions.hostName):$scHttpsPort"
} catch {
    if ($scChanged) {
        Stop-Service -Name ServiceCenterHttps -ErrorAction SilentlyContinue
        Stop-Service -Name ServiceCenterApp -ErrorAction SilentlyContinue
    } elseif ($scReadyExisting) {
        try { & $scOldNode (Join-Path $scExisting.releaseDir 'scripts/windows/service-control.mjs') resume } catch {}
    }
    Write-Error $_
    exit 1
} finally {
    if (Test-Path -LiteralPath $OptionsFile) { Remove-Item -LiteralPath $OptionsFile -Force }
    $scPassword=$null; $scPgAdminPassword=$null
    try { Stop-Transcript | Out-Null } catch {}
}
