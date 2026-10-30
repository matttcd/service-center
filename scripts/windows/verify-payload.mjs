import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { root } from './download.mjs'

assert.equal(process.platform, 'win32')
const directory = fs.mkdtempSync(path.join(root, 'tools/windows-payload-check-'))
const app = path.join(directory, 'Programa ñ')
const previous = path.join(app, 'versions/1.2.0-old')
const stage = path.join(directory, 'stage')
const compiler = process.env.MAKENSIS_PATH || path.join(root, 'tools/nsis/makensis.exe')
const quote = (value) => "'" + value.replaceAll("'", "''") + "'"
const hash = (data) => createHash('sha256').update(data).digest('hex')
const files = new Map([
  ['runtime/node/node.exe', randomBytes(1024 * 1024)],
  ['runtime/chromium/assets.pak', randomBytes(512 * 1024)],
  ['server/index.js', Buffer.from('versión nueva')],
  ['docs/guía [ñ].md', Buffer.from('documentación igual')],
  ['dist/index.html', Buffer.from('<h1>Nueva interfaz</h1>')],
])
const inventory = [...files].map(([name, bytes]) => ({ path: name, size: bytes.length, sha256: hash(bytes) }))
function write(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data) }
function manifest(destination) {
  const value = { version: '1.2.1', releaseId: path.basename(destination), platform: 'win32-x64', files: inventory }
  const file = path.join(stage, 'manifest.json')
  write(file, JSON.stringify(value))
  return file
}
function powershell(script, status = 0) {
  const file = path.join(directory, 'check.ps1')
  write(file, '\uFEFF$ErrorActionPreference="Stop"\n' + script)
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file], { windowsHide: true, encoding: 'utf8' })
  assert.equal(result.status, status, result.stdout + result.stderr)
  return result.stdout.trim()
}
function prepare(destination, { source = previous, verify = false, copy = false, status = 0 } = {}) {
  const input = manifest(destination)
  return powershell(`. ${quote(path.join(root, 'installer/windows/deployment.ps1'))}\n. ${quote(path.join(root, 'installer/windows/payload.ps1'))}\n${copy ? 'function New-SCPayloadLink { return $false }\n' : ''}Initialize-SCPayload ${quote(destination)} ${quote(input)} ${source ? quote(source) : '$null'} ${verify ? '-Verify' : ''} | ConvertTo-Json -Compress`, status)
}
function extract(destination) {
  const executable = path.join(directory, 'extract.exe')
  const script = path.join(directory, 'extract.nsi')
  write(script, `# -*- coding: utf-8 -*-\nUnicode true\nRequestExecutionLevel user\nSilentInstall silent\nSetCompressor zlib\nOutFile "${executable}"\nSection\nSetOutPath "${destination}"\nSetOverwrite off\nClearErrors\nFile /r "${stage}\\*"\nIfErrors 0 +3\nSetErrorLevel 1\nAbort\nSectionEnd\n`)
  const compiled = spawnSync(compiler, ['/V2', script], { windowsHide: true, encoding: 'utf8' })
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr)
  const installed = spawnSync(executable, [], { windowsHide: true, encoding: 'utf8' })
  assert.equal(installed.status, 0, installed.stdout + installed.stderr)
}
try {
  for (const [name, bytes] of files) write(path.join(stage, name), bytes)
  for (const name of ['runtime/node/node.exe', 'runtime/chromium/assets.pak', 'docs/guía [ñ].md']) write(path.join(previous, name), files.get(name))
  write(path.join(previous, 'server/index.js'), 'versión anterior')
  write(path.join(previous, 'server/retired.js'), 'solo anterior')
  write(path.join(previous, 'manifest.json'), JSON.stringify({ version: '1.2.0', releaseId: path.basename(previous), platform: 'win32-x64', files: [...inventory.filter((entry) => fs.existsSync(path.join(previous, entry.path))), { path: 'server/retired.js' }] }))
  const destination = path.join(app, 'versions/1.2.1-new')
  const oldExe = path.join(previous, 'runtime/node/node.exe')
  fs.utimesSync(oldExe, new Date('2000-01-01'), new Date('2000-01-01'))
  const before = fs.statSync(oldExe)
  const result = JSON.parse(prepare(destination))
  console.log('✓ Preparación de archivos idénticos por SHA-256.')
  assert.equal(result.linked + result.copied, 3)
  assert.equal(result.extract, 2)
  assert.ok(result.linked >= 2, 'NTFS debe reutilizar los runtimes mediante enlaces físicos.')
  const reusedExe = path.join(destination, 'runtime/node/node.exe')
  assert.equal(fs.statSync(reusedExe).ino, before.ino)
  prepare(destination, { verify: true, status: 1 }) // Faltan los dos archivos nuevos.
  extract(destination) // NSIS real, sin UAC, servicios ni acceso a datos instalados.
  console.log('✓ Extracción NSIS ejecutada.')
  assert.equal(JSON.parse(prepare(destination, { verify: true })).verified, files.size)
  assert.equal(fs.statSync(reusedExe).ino, before.ino)
  assert.equal(fs.statSync(oldExe).mtimeMs, before.mtimeMs, 'NSIS no debe sobrescribir un archivo compartido.')
  assert.equal(hash(fs.readFileSync(oldExe)), inventory[0].sha256)
  assert.equal(fs.readFileSync(path.join(previous, 'server/index.js'), 'utf8'), 'versión anterior')
  assert.equal(fs.existsSync(path.join(destination, 'server/retired.js')), false)
  assert.equal(JSON.parse(prepare(destination)).existing, files.size, 'Repetir una entrega completa no vuelve a extraer.')
  // La reparación de una extracción interrumpida solo retira el archivo inválido del destino inactivo.
  write(path.join(destination, 'server/index.js'), 'dañado')
  const repaired = JSON.parse(prepare(destination))
  assert.equal(repaired.existing, 4); assert.equal(repaired.extract, 1)
  extract(destination)
  prepare(destination, { verify: true })
  // Rechazar daño en una versión activa y no modificar sus bytes.
  write(path.join(destination, 'server/index.js'), 'activo dañado')
  prepare(destination, { source: destination, status: 1 })
  assert.equal(fs.readFileSync(path.join(destination, 'server/index.js'), 'utf8'), 'activo dañado')
  // Disco sin enlaces físicos: copia verificada, sin descomprimir los runtimes del instalador.
  const copied = path.join(app, 'versions/1.2.1-copy')
  const fallback = JSON.parse(prepare(copied, { copy: true }))
  assert.equal(fallback.copied, 3); assert.equal(fallback.linked, 0)
  assert.notEqual(fs.statSync(path.join(copied, 'runtime/node/node.exe')).ino, before.ino)
  extract(copied); prepare(copied, { verify: true })
  console.log('✓ Reparación y copia alternativa comprobadas.')
  // Un archivo anterior alterado no se considera reutilizable.
  const corruptSource = path.join(app, 'versions/1.2.0-corrupt')
  for (const name of [...files.keys(), 'server/retired.js', 'manifest.json']) {
    const source = path.join(previous, name)
    if (fs.existsSync(source)) write(path.join(corruptSource, name), fs.readFileSync(source))
  }
  const oldManifest = JSON.parse(fs.readFileSync(path.join(corruptSource, 'manifest.json')))
  oldManifest.releaseId = path.basename(corruptSource)
  write(path.join(corruptSource, 'manifest.json'), JSON.stringify(oldManifest))
  write(path.join(corruptSource, 'runtime/node/node.exe'), randomBytes(1024 * 1024))
  const fresh = path.join(app, 'versions/1.2.1-fresh')
  assert.equal(JSON.parse(prepare(fresh, { source: corruptSource })).extract, 3)
  extract(fresh); prepare(fresh, { verify: true })
  // Instalación nueva y rutas inseguras, sin tocar archivos fuera de versions/.
  const empty = path.join(app, 'versions/1.2.1-empty')
  assert.equal(JSON.parse(prepare(empty, { source: null })).extract, files.size)
  extract(empty); prepare(empty, { source: null, verify: true })
  const input = manifest(empty)
  const unsafe = JSON.parse(fs.readFileSync(input)); unsafe.files.push({ ...inventory[0], path: '../escape.exe' })
  write(input, JSON.stringify(unsafe))
  powershell(`. ${quote(path.join(root, 'installer/windows/deployment.ps1'))}\n. ${quote(path.join(root, 'installer/windows/payload.ps1'))}\nInitialize-SCPayload ${quote(empty)} ${quote(input)} $null`, 1)
  assert.equal(fs.existsSync(path.join(app, 'versions/escape.exe')), false)
  const valid = { ...unsafe, files: inventory }
  write(input, JSON.stringify({ ...valid, files: [...inventory, inventory[0]] }))
  powershell(`. ${quote(path.join(root, 'installer/windows/deployment.ps1'))}\n. ${quote(path.join(root, 'installer/windows/payload.ps1'))}\nInitialize-SCPayload ${quote(empty)} ${quote(input)} $null`, 1)
  write(input, JSON.stringify(valid))
  const junction = path.join(empty, 'external')
  fs.symlinkSync(previous, junction, 'junction')
  try { powershell(`. ${quote(path.join(root, 'installer/windows/deployment.ps1'))}\n. ${quote(path.join(root, 'installer/windows/payload.ps1'))}\nInitialize-SCPayload ${quote(empty)} ${quote(input)} $null`, 1) }
  finally { fs.unlinkSync(junction) }
  assert.equal(hash(fs.readFileSync(oldExe)), inventory[0].sha256)
  write(path.join(empty, 'unknown.txt'), 'conservar archivo ajeno')
  prepare(empty, { source: null, status: 1 })
  assert.equal(fs.readFileSync(path.join(empty, 'unknown.txt'), 'utf8'), 'conservar archivo ajeno')
  const setup = fs.readFileSync(path.join(root, 'installer/windows/setup.nsi'), 'utf8')
  assert.match(setup, /^SetCompressor zlib$/m)
  assert.ok(setup.indexOf('-Verify\'') < setup.indexOf("DetailPrint 'Comprobando Microsoft Visual"))
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true })
  fs.writeFileSync(path.join(root, 'test-results/windows-incremental.json'), JSON.stringify({ ...result, actualNsisExtraction: true, fallbackCopy: true, freshInstall: true, interruptedRepair: true, corruptSource: true, unsafePathRejected: true, duplicateRejected: true, junctionRejected: true, unknownPreserved: true }, null, 2))
  console.log(`✓ Actualización selectiva: ${result.linked} archivos compartidos, ${result.copied} copiados y ${result.extract} extraídos por NSIS. ${result.reusedBytes} bytes reutilizados; versión anterior intacta. Reparación, instalación nueva, copia alternativa y rutas verificadas.`)
} finally {
  console.log('Retirando archivos temporales de la prueba de extracción…')
  const resolved = path.resolve(directory)
  if (path.dirname(resolved) === path.join(root, 'tools') && path.basename(resolved).startsWith('windows-payload-check-')) fs.rmSync(resolved, { recursive: true, force: true })
}
