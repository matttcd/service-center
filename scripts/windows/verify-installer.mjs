// Comprueba rutas, Unicode y retiro de archivos sin registrar servicios del host.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { root } from './download.mjs'

assert.equal(process.platform, 'win32')
const directory = fs.mkdtempSync(path.join(root, 'tools/windows-installer-check-'))
const appDir = path.join(directory, 'Programa á')
const dataDir = path.join(directory, 'Datos ñ')
const optionsFile = path.join(directory, 'options.json')
const options = { appDir, dataDir, adminPassword: 'Prueba "ñ" \\ contraseña', hostName: 'local', httpsPort: '443' }
const quote = (value) => "'" + value.replaceAll("'", "''") + "'"
function preflight(expected, registered = false) {
  fs.writeFileSync(optionsFile, '\uFEFF' + JSON.stringify(options), 'utf16le')
  let script = path.join(root, 'installer/windows/preflight.ps1')
  let args = ['-OptionsFile', optionsFile]
  if (registered) {
    const wrapper = `function Get-ItemProperty { [pscustomobject]@{AppDir=${quote(appDir)};DataDir=${quote(dataDir)}} }\n& ${quote(script)} -OptionsFile ${quote(optionsFile)}\nexit $LASTEXITCODE`
    script = path.join(directory, 'registered-preflight.ps1')
    fs.writeFileSync(script, '\uFEFF' + wrapper)
    args = []
  }
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args], { windowsHide: true, encoding: 'utf8' })
  assert.equal(result.status, expected, result.stdout + result.stderr)
}
try {
  preflight(0)
  assert.equal(fs.existsSync(appDir), false, 'El preflight no crea carpetas.')
  options.serviceAccount = 'Admin'
  options.servicePassword = 'Prueba Windows'
  preflight(1)
  options.serviceAccount = 'TALLER\\impresion'
  options.servicePassword = ''
  preflight(1)
  options.servicePassword = 'Prueba Windows'
  preflight(0)
  options.serviceAccount = ''
  options.servicePassword = ''
  options.dataDir = appDir
  preflight(1)
  options.dataDir = path.join(appDir, 'datos')
  preflight(1)
  options.dataDir = dataDir
  fs.mkdirSync(appDir)
  fs.writeFileSync(path.join(appDir, 'ajeno.txt'), 'Conservar')
  preflight(1)
  const version = path.join(appDir, 'versions/test-release')
  fs.mkdirSync(version, { recursive: true })
  fs.writeFileSync(path.join(version, 'program.txt'), 'Retirar programa')
  fs.writeFileSync(path.join(version, 'manifest.json'), JSON.stringify({ releaseId: 'test-release', platform: 'win32-x64', files: [{ path: 'program.txt' }] }))
  preflight(1, true) // Un registro no autoriza adoptar archivos ajenos.
  fs.unlinkSync(path.join(appDir, 'ajeno.txt'))
  preflight(1) // Sin registro tampoco se adopta una carpeta con manifiesto.
  preflight(0, true) // Reintento de la instalación interrumpida 1.1.0.
  fs.writeFileSync(path.join(version, 'ajeno.txt'), 'Conservar')
  preflight(1, true)
  fs.unlinkSync(path.join(version, 'ajeno.txt'))
  const manifestFile = path.join(version, 'manifest.json')
  const manifest = fs.readFileSync(manifestFile)
  fs.writeFileSync(manifestFile, JSON.stringify({ releaseId: 'test-release', platform: 'win32-x64', files: [{ path: '../../escape.txt' }] }))
  preflight(1, true)
  fs.writeFileSync(manifestFile, manifest)
  fs.writeFileSync(path.join(appDir, 'ajeno.txt'), 'Conservar')
  fs.mkdirSync(dataDir)
  fs.writeFileSync(path.join(dataDir, 'empresa.txt'), 'Conservar datos')
  preflight(1, true)
  fs.writeFileSync(path.join(dataDir, 'installation.json'), JSON.stringify({ appDir, dataDir, status: 'ready' }))
  preflight(0)
  // Las funciones reemplazan solo las operaciones sobre servicios/firewall.
  const script = `function Get-CimInstance {}\nfunction Get-NetFirewallRule {}\nfunction Remove-NetFirewallRule {}\n& ${quote(path.join(root, 'installer/windows/uninstall.ps1'))} -AppDir ${quote(appDir)} -DataDir ${quote(dataDir)}`
  const checkFile = path.join(directory, 'uninstall-check.ps1')
  fs.writeFileSync(checkFile, '\uFEFF' + script, 'utf8')
  fs.writeFileSync(path.join(appDir, 'escape.txt'), 'Conservar fuera de la version')
  fs.writeFileSync(manifestFile, JSON.stringify({ releaseId: 'test-release', platform: 'win32-x64', files: [{ path: 'program.txt' }, { path: '../../escape.txt' }] }))
  const rejected = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', checkFile], { windowsHide: true, encoding: 'utf8' })
  assert.equal(rejected.status, 1, 'No se deben retirar archivos de un manifiesto que escapa del programa.')
  assert.equal(fs.readFileSync(path.join(version, 'program.txt'), 'utf8'), 'Retirar programa')
  fs.writeFileSync(manifestFile, manifest)
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', checkFile], { windowsHide: true, stdio: 'pipe' })
  assert.equal(fs.existsSync(version), false)
  assert.equal(fs.readFileSync(path.join(dataDir, 'empresa.txt'), 'utf8'), 'Conservar datos')
  assert.equal(fs.readFileSync(path.join(appDir, 'ajeno.txt'), 'utf8'), 'Conservar')
  assert.equal(fs.readFileSync(path.join(appDir, 'escape.txt'), 'utf8'), 'Conservar fuera de la version')
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'installation.json'), 'utf8')).status, 'uninstalled')
  console.log('✓ Asistente: cuentas Windows, JSON Unicode, reintento de instalación interrumpida, rutas y conservación de archivos ajenos (registro/servicios simulados).')
} finally {
  const resolved = path.resolve(directory)
  if (path.dirname(resolved) === path.join(root, 'tools') && path.basename(resolved).startsWith('windows-installer-check-')) fs.rmSync(resolved, { recursive: true, force: true })
}
