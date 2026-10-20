param([string]$Destination)
$ErrorActionPreference = 'Stop'
$scRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if (-not $Destination) { $Destination = Join-Path $scRoot 'tools/windows-helper' }
$scPython = Join-Path $scRoot 'tools/build-python/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $scPython)) { throw 'Crear tools/build-python e instalar scripts/windows/requirements-build.txt antes de construir.' }
$scVersion = & $scPython -c 'import platform; print(platform.python_version())'
if ($scVersion -ne '3.14.3') { throw 'El empaquetador de impresión requiere Python 3.14.3 x64 para mantener fijo su runtime.' }
$scFreeze = & $scPython -m pip freeze
if ($LASTEXITCODE -ne 0) { throw 'No se pudo verificar el entorno de empaquetado.' }
foreach ($scPin in Get-Content -LiteralPath (Join-Path $scRoot 'scripts/windows/requirements-build.txt')) {
    if ($scPin.Trim() -and $scFreeze -notcontains $scPin.Trim()) { throw "El entorno de construcción no coincide con la dependencia fijada: $scPin" }
}
& $scPython -m PyInstaller --noconfirm --onedir --name ServiceCenterPrint --distpath $Destination --workpath (Join-Path $scRoot 'tools/pyinstaller-work') --specpath (Join-Path $scRoot 'tools/pyinstaller-spec') --paths (Join-Path $scRoot 'server/printer') --hidden-import win32print --hidden-import win32api --hidden-import zpl_printer (Join-Path $scRoot 'server/printer/windows_print.py')
if ($LASTEXITCODE -ne 0) { throw 'Falló el empaquetado del componente de impresión.' }
