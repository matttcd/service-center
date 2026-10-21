import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import https from 'node:https'
import { randomBytes } from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import assert from 'node:assert/strict'
import { root, sha256 } from './download.mjs'
import { decryptBackup } from '../../server/backup-crypto.js'
import { verifyAdminRecovery } from './verify-admin-recovery.mjs'

assert.equal(process.platform, 'win32')
execFileSync(process.execPath, [path.join(root, 'scripts/windows/verify-installer.mjs')], { windowsHide: true, stdio: 'inherit' })
const build = JSON.parse(fs.readFileSync(path.join(root, 'release/last-build.json'), 'utf8'))
const payload = path.resolve(build.payload)
assert.equal(path.dirname(path.dirname(payload)), path.join(root, 'tools'))
const manifest = JSON.parse(fs.readFileSync(path.join(payload, 'manifest.json'), 'utf8'))
for (const entry of manifest.files) {
  assert.equal(await sha256(path.join(payload, entry.path)), entry.sha256, `Archivo modificado: ${entry.path}`)
  assert.equal(/(^|\/)\.env$|\.dump$|^(server\/)?data\//.test(entry.path), false, `Dato privado en el paquete: ${entry.path}`)
}
console.log('✓ Integridad del paquete y exclusión de secretos verificadas.')
if (process.argv.includes('--integrity-only')) process.exit(0)
const temporary = fs.mkdtempSync(path.join(root, 'tools/windows-verify-'))
const bundledNode = path.join(payload, 'runtime/node/node.exe')
const pgBin = path.join(payload, 'runtime/pgsql/bin')
const envFile = path.join(temporary, 'service.json')
const freePort = () => new Promise((resolve, reject) => {
  const socket = net.createServer()
  socket.on('error', reject)
  socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)) })
})
const pgPort = await freePort()
const tlsPort = await freePort()
const password = randomBytes(24).toString('hex')
const adminPassword = randomBytes(24).toString('hex')
const minimalPath = `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}`
const hostEnv = { ...process.env, PATH: minimalPath, SERVICE_CENTER_ENV_FILE: envFile }
const settings = {
  NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '8181', TZ: 'America/Argentina/Buenos_Aires',
  DATABASE_URL: `postgresql://service_center:${password}@127.0.0.1:${pgPort}/service_center_verify`,
  PG_BIN_DIR: pgBin, DATA_DIR: path.join(temporary, 'data'), BACKUP_EXPORT_DIR: path.join(temporary, 'exported'),
  JWT_SECRET: randomBytes(48).toString('hex'), BACKUP_ENCRYPTION_KEY: randomBytes(32).toString('hex'), INITIAL_ADMIN_PASSWORD: 'admin123',
  WINDOWS_PRINT_HELPER: path.join(payload, 'runtime/printer/ServiceCenterPrint.exe'),
  SUMATRA_PDF: path.join(payload, 'runtime/sumatra/SumatraPDF.exe'), PRINT_TEMP_DIR: path.join(temporary, 'print-tmp'), PRINT_TRANSPORT: 'windows',
  PUPPETEER_EXECUTABLE_PATH: path.join(payload, 'runtime/chromium/chrome-headless-shell.exe'),
  BROWSER_DATA_DIR: path.join(temporary, 'browser'), TEMP: path.join(temporary, 'tmp'), TMP: path.join(temporary, 'tmp'),
  SERVICE_CONTROL_PIPE: `\\\\.\\pipe\\ServiceCenterVerify-${randomBytes(8).toString('hex')}`, SERVICE_CONTROL_TOKEN: randomBytes(32).toString('hex'),
  VERIFICATION_INSTANCE: 'service-center-isolated-tests', INSTANCE_ID: randomBytes(16).toString('hex'), APP_VERSION: build.version,
}
let postgres, server, gateway
for (const key of Object.keys(settings)) delete hostEnv[key]
let serverLog = '', pgLog = '', gatewayLog = ''
const pgEnv = { ...hostEnv, PGHOST: '127.0.0.1', PGPORT: String(pgPort), PGUSER: 'sc_admin', PGPASSWORD: adminPassword, PGDATABASE: 'postgres' }
function run(file, args, env = hostEnv) {
  return new Promise((resolve, reject) => {
    const process = spawn(file, args, { cwd: root, env, windowsHide: true, stdio: 'inherit' })
    process.on('error', reject)
    process.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${path.basename(file)}: código ${code}`)))
  })
}
function control(command) {
  execFileSync(bundledNode, [path.join(payload, 'scripts/windows/service-control.mjs'), command], { env: hostEnv, windowsHide: true, timeout: command === 'maintenance' ? 40000 : 20000, stdio: 'pipe' })
}
async function stopServer() {
  if (server && server.exitCode === null && server.signalCode === null) {
    const closed = once(server, 'exit')
    try { control('shutdown') } catch { server.kill('SIGTERM') }
    await closed
  }
}
async function startServer(db = 'service_center_verify') {
  fs.mkdirSync(settings.TEMP, { recursive: true })
  settings.DATABASE_URL = `postgresql://service_center:${password}@127.0.0.1:${pgPort}/${db}`
  fs.writeFileSync(envFile, JSON.stringify(settings))
  serverLog = ''
  server = spawn(bundledNode, [path.join(payload, 'server/start-production.js')], { cwd: payload, env: hostEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  server.stdout.on('data', (chunk) => { serverLog += chunk })
  server.stderr.on('data', (chunk) => { serverLog += chunk })
  for (let n = 0; n < 180; n++) {
    if (server.exitCode !== null) break
    const health = await fetch('http://127.0.0.1:8181/api/health').then((r) => r.json()).catch(() => null)
    if (health?.instance === settings.INSTANCE_ID) return
    await delay(500)
  }
  throw new Error('No arrancó el servidor empaquetado.\n' + serverLog)
}
try {
  await new Promise((resolve, reject) => {
    const listener = net.createServer()
    listener.on('error', () => reject(new Error('El puerto 8181 está ocupado.')))
    listener.listen(8181, '127.0.0.1', () => listener.close(resolve))
  })
  const pwFile = path.join(temporary, 'init-password')
  fs.writeFileSync(pwFile, adminPassword)
  const pgData = path.join(temporary, 'postgres')
  execFileSync(path.join(pgBin, 'initdb.exe'), ['-D', pgData, '-U', 'sc_admin', '--encoding=UTF8', '--locale=C', '--auth=scram-sha-256', `--pwfile=${pwFile}`], { env: hostEnv, windowsHide: true, stdio: 'pipe' })
  fs.unlinkSync(pwFile)
  postgres = spawn(path.join(pgBin, 'postgres.exe'), ['-D', pgData, '-p', String(pgPort), '-h', '127.0.0.1'], { env: hostEnv, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
  postgres.stderr.on('data', (chunk) => { pgLog += chunk })
  for (let n = 0; n < 90 && !pgLog.includes('ready to accept connections'); n++) await delay(500)
  assert.ok(pgLog.includes('ready to accept connections'), pgLog)
  execFileSync(path.join(pgBin, 'psql.exe'), ['-v', 'ON_ERROR_STOP=1'], { env: pgEnv, input: `CREATE ROLE service_center LOGIN PASSWORD '${password}'; CREATE DATABASE service_center_verify OWNER service_center; CREATE DATABASE service_center_verify_ui OWNER service_center; CREATE DATABASE service_center_verify_restore OWNER service_center;`, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
  await startServer()
  console.log('✓ Node y PostgreSQL empaquetados, usuario de base sin superusuario y PATH sin Python/Node globales.')
  control('maintenance')
  assert.equal((await fetch('http://127.0.0.1:8181/api/bootstrap')).status, 503)
  control('resume')
  assert.equal((await fetch('http://127.0.0.1:8181/api/bootstrap')).status, 401)
  console.log('✓ Control local de mantenimiento y reanudación del servicio.')
  await run(bundledNode, ['--test', 'tests/integration/workflow.mjs'], { ...hostEnv, VERIFY_URL: 'http://127.0.0.1:8181' })
  const login = await fetch('http://127.0.0.1:8181/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@local.com', password: 'Verification-admin-2026' }) }).then((r) => r.json())
  const headers = { Authorization: `Bearer ${login.token}` }
  const printers = await fetch('http://127.0.0.1:8181/api/printing/config', { headers }).then((r) => r.json())
  assert.equal(printers.transport, 'windows')
  assert.equal(printers.error, null, JSON.stringify(printers))
  assert.ok(printers.account)
  // El instalador debe poder comprobar la identidad del auxiliar real.
  const printerIdentity = JSON.parse(execFileSync(bundledNode, [path.join(payload, 'scripts/windows/service-control.mjs'), 'printers'], { env: hostEnv, windowsHide: true, encoding: 'utf8' }))
  assert.match(printerIdentity.sid, /^S-1-/)
  assert.equal(typeof printerIdentity.admin, 'boolean')
  console.log('✓ Ejecutable de impresión autónomo: enumera colas y cuenta sin Python instalado en PATH.')
  const order = (await fetch('http://127.0.0.1:8181/api/orders', { headers }).then((r) => r.json())).orders[0]
  const labelResponse = await fetch(`http://127.0.0.1:8181/api/orders/${order.id}/label-pdf`, { headers })
  assert.equal(labelResponse.status, 200)
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true })
  fs.writeFileSync(path.join(root, 'test-results/label.pdf'), Buffer.from(await labelResponse.arrayBuffer()))
  assert.equal((await fetch('http://127.0.0.1:8181/api/printing/test', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{"kind":"order"}' })).status, 400)
  const previousKey = settings.BACKUP_ENCRYPTION_KEY
  await stopServer()
  settings.PG_BIN_DIR = path.join(temporary, 'runtime-retirado')
  fs.writeFileSync(envFile, JSON.stringify(settings))
  try {
    const safety = JSON.parse(execFileSync(bundledNode, [path.join(payload, 'server/backup-before-update.js'), pgBin], { env: hostEnv, windowsHide: true, encoding: 'utf8' }).trim().split('\n').at(-1))
    assert.ok(safety.name)
    assert.ok(decryptBackup(fs.readFileSync(path.join(temporary, 'data/backups', safety.name)), previousKey).subarray(0, 5).equals(Buffer.from('PGDMP')))
  } finally { settings.PG_BIN_DIR = pgBin; fs.writeFileSync(envFile, JSON.stringify(settings)) }
  await startServer()
  console.log('✓ Respaldo previo con aplicación detenida y runtime PostgreSQL anterior retirado, sin cambiar claves/configuración.')
  const backup = fs.readdirSync(path.join(temporary, 'data/backups')).filter((name) => /^db-\d+\.dump$/.test(name)).sort().at(-1)
  await stopServer()
  settings.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString('hex')
  await startServer('service_center_verify_restore')
  control('maintenance')
  const restored = JSON.parse(execFileSync(bundledNode, [path.join(payload, 'server/backup-cli.js'), 'restore-file', path.join(temporary, 'data/backups', backup), '--confirm'], { env: hostEnv, input: JSON.stringify({ key: previousKey }), windowsHide: true, stdio: 'pipe', encoding: 'utf8' }).trim().split('\n').at(-1))
  assert.ok(decryptBackup(fs.readFileSync(path.join(temporary, 'data/backups', restored.restored)), settings.BACKUP_ENCRYPTION_KEY).subarray(0, 5).equals(Buffer.from('PGDMP')))
  assert.equal(JSON.parse(fs.readFileSync(envFile, 'utf8')).BACKUP_ENCRYPTION_KEY, settings.BACKUP_ENCRYPTION_KEY)
  control('resume')
  const recovered = await fetch('http://127.0.0.1:8181/api/orders', { headers }).then((r) => r.json())
  assert.ok(recovered.total > 0)
  console.log('✓ Recuperación de una copia con clave de otra instalación y conservación de la clave del destino.')
  await verifyAdminRecovery({ payload, env: hostEnv, settings, envFile, restartServer: async () => { await stopServer(); await startServer('service_center_verify_restore') } })
  await stopServer()
  await startServer('service_center_verify_ui')
  await run(bundledNode, ['tests/integration/browser.mjs'], { ...hostEnv, VERIFY_URL: 'http://127.0.0.1:8181', PUPPETEER_EXECUTABLE_PATH: process.env.SC_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const caddyConfig = path.join(temporary, 'Caddyfile')
  const tlsData = path.join(temporary, 'tls').replaceAll('\\', '/')
  fs.writeFileSync(caddyConfig, `{\n admin off\n auto_https disable_redirects\n skip_install_trust\n storage file_system "${tlsData}"\n}\nhttps://localhost:${tlsPort} {\n bind 127.0.0.1\n tls internal\n reverse_proxy 127.0.0.1:8181\n}\n`)
  gateway = spawn(path.join(payload, 'runtime/caddy/caddy.exe'), ['run', '--config', caddyConfig, '--adapter', 'caddyfile'], { env: hostEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  gateway.stdout.on('data', (chunk) => { gatewayLog += chunk })
  gateway.stderr.on('data', (chunk) => { gatewayLog += chunk })
  const rootCa = path.join(temporary, 'tls/pki/authorities/local/root.crt')
  for (let n = 0; n < 60 && !fs.existsSync(rootCa); n++) await delay(500)
  assert.ok(fs.existsSync(rootCa), gatewayLog)
  let health
  for (let n = 0; n < 60; n++) {
    health = await new Promise((resolve, reject) => {
      const request = https.get(`https://localhost:${tlsPort}/api/health`, { ca: fs.readFileSync(rootCa), timeout: 2000 }, (response) => {
        let body = ''
        response.on('data', (chunk) => { body += chunk })
        response.on('end', () => { try { resolve(JSON.parse(body)) } catch (error) { reject(error) } })
      }).on('error', reject)
      request.on('timeout', () => request.destroy(new Error('HTTPS sin respuesta.')))
    }).catch(() => null)
    if (health?.instance === settings.INSTANCE_ID) break
    await delay(500)
  }
  assert.ok(health, gatewayLog)
  assert.equal(health.instance, settings.INSTANCE_ID)
  console.log('✓ Caddy empaquetado con HTTPS y certificado verificado, sin modificar certificados del host.')
  console.log('Verificación del paquete Windows completada; no se instalaron servicios ni se enviaron trabajos físicos.')
} catch (error) {
  console.error(error.message)
  console.error(serverLog.slice(-5000), gatewayLog.slice(-2000))
  process.exitCode = 1
} finally {
  if (gateway && gateway.exitCode === null && gateway.signalCode === null) { const closed = once(gateway, 'exit'); gateway.kill('SIGTERM'); await closed }
  await stopServer()
  if (postgres && postgres.exitCode === null && postgres.signalCode === null) { const closed = once(postgres, 'exit'); postgres.kill('SIGTERM'); await closed }
  const resolved = path.resolve(temporary)
  if (path.dirname(resolved) === path.join(root, 'tools') && path.basename(resolved).startsWith('windows-verify-')) fs.rmSync(resolved, { recursive: true, force: true })
}
