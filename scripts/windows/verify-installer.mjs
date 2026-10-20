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
function preflight(expected) {
  fs.writeFileSync(optionsFile, '\uFEFF' + JSON.stringify(options), 'utf16le')
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'installer/windows/preflight.ps1'), '-OptionsFile', optionsFile], { windowsHide: true, encoding: 'utf8' })
  assert.equal(result.status, expected, result.stdout + result.stderr)
}
try {
  preflight(0)
  assert.equal(fs.existsSync(appDir), false, 'El preflight no crea carpetas.')
  options.dataDir = appDir
  preflight(1)
  options.dataDir = path.join(appDir, 'datos')
  preflight(1)
  options.dataDir = dataDir
  fs.mkdirSync(appDir)
  fs.writeFileSync(path.join(appDir, 'ajeno.txt'), 'Conservar')
  preflight(1)
  fs.mkdirSync(dataDir)
  fs.writeFileSync(path.join(dataDir, 'empresa.txt'), 'Conservar datos')
  const version = path.join(appDir, 'versions/test-release')
  fs.mkdirSync(version, { recursive: true })
  fs.writeFileSync(path.join(version, 'program.txt'), 'Retirar programa')
  fs.writeFileSync(path.join(version, 'manifest.json'), JSON.stringify({ releaseId: 'test-release', platform: 'win32-x64', files: [{ path: 'program.txt' }] }))
  fs.writeFileSync(path.join(dataDir, 'installation.json'), JSON.stringify({ appDir, dataDir, status: 'ready' }))
  preflight(0)
  const quote = (value) => "'" + value.replaceAll("'", "''") + "'"
  // Las funciones reemplazan solo las operaciones sobre servicios/firewall.
  const script = `function Get-CimInstance {}\nfunction Get-NetFirewallRule {}\nfunction Remove-NetFirewallRule {}\n& ${quote(path.join(root, 'installer/windows/uninstall.ps1'))} -AppDir ${quote(appDir)} -DataDir ${quote(dataDir)}`
  const checkFile = path.join(directory, 'uninstall-check.ps1')
  fs.writeFileSync(checkFile, '\uFEFF' + script, 'utf8')
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', checkFile], { windowsHide: true, stdio: 'pipe' })
  assert.equal(fs.existsSync(version), false)
  assert.equal(fs.readFileSync(path.join(dataDir, 'empresa.txt'), 'utf8'), 'Conservar datos')
  assert.equal(fs.readFileSync(path.join(appDir, 'ajeno.txt'), 'utf8'), 'Conservar')
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'installation.json'), 'utf8')).status, 'uninstalled')
  console.log('✓ Asistente: JSON Unicode, validación de rutas y desinstalación conservando datos/archivos ajenos (servicios simulados).')
} finally {
  const resolved = path.resolve(directory)
  if (path.dirname(resolved) === path.join(root, 'tools') && path.basename(resolved).startsWith('windows-installer-check-')) fs.rmSync(resolved, { recursive: true, force: true })
}
