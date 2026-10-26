import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { encryptBackup, postgresConnection } from '../server/backup-crypto.js'
import bcrypt from '../server/node_modules/bcryptjs/index.js'
import net from 'node:net'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import EmbeddedPostgres from 'embedded-postgres'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tools = path.join(root, 'tools')
fs.mkdirSync(tools, { recursive: true })
const temporary = fs.mkdtempSync(path.join(tools, 'verify-'))
const pgPort = await new Promise((resolve, reject) => {
  const socket = net.createServer()
  socket.once('error', reject)
  socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)) })
})
const pgPassword = randomBytes(24).toString('hex')
const database = new EmbeddedPostgres({
  databaseDir: path.join(temporary, 'postgres'), user: 'verify', password: pgPassword,
  port: pgPort, persistent: true, authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {}, onError: (message) => console.error(String(message)),
})
const platform = process.platform === 'win32' ? 'windows' : process.platform
const { pg_ctl: pgCtl } = await import(`@embedded-postgres/${platform}-${process.arch}`)
// pg_ctl cierra solo este cluster y funciona también en entornos donde taskkill
// está restringido. Evita dejar procesos de prueba al cerrar el wrapper.
database.stop = async () => {
  const child = database.process
  if (!child || child.exitCode !== null || child.signalCode !== null) { database.process = undefined; return }
  const closed = once(child, 'exit')
  if (process.platform === 'win32') child.kill('SIGTERM')
  else await run(pgCtl, ['-D', path.join(temporary, 'postgres'), 'stop', '-m', 'fast', '-w', '-t', '15'], process.env)
  await closed
  database.process = undefined
}
let server
let serverLog = ''
async function run(file, args, env) {
  const child = spawn(file, args, { cwd: root, env, windowsHide: true, stdio: 'inherit' })
  const [code] = await once(child, 'exit')
  if (code !== 0) throw new Error(`${path.basename(file)} finalizó con código ${code}.`)
}
async function stopServer() {
  if (server && server.exitCode === null && server.signalCode === null) {
    const closed = once(server, 'exit')
    if (server.connected) server.send('verification-shutdown')
    else server.kill('SIGTERM')
    await closed
  }
}
async function startServer(env) {
  serverLog = ''
  server = spawn(process.execPath, ['server/start-production.js'], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  server.stdout.on('data', (chunk) => { serverLog += chunk; if (process.env.VERIFY_VERBOSE) process.stdout.write(chunk) })
  server.stderr.on('data', (chunk) => { serverLog += chunk; if (process.env.VERIFY_VERBOSE) process.stderr.write(chunk) })
  server.on('error', (err) => { serverLog += err.message })
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) break
    const health = await fetch('http://127.0.0.1:8181/api/health').then((r) => r.json()).catch(() => null)
    if (health?.verification === env.VERIFICATION_INSTANCE) return
    await delay(500)
  }
  throw new Error(`No arrancó el servidor de verificación.\n${serverLog}`)
}
try {
  // Rechaza un puerto HTTP ocupado antes de crear una base o ejecutar pruebas.
  await new Promise((resolve, reject) => {
    const socket = net.createServer()
    socket.once('error', () => reject(new Error('El puerto 8181 está ocupado. Cerrá solamente el entorno de pruebas anterior.')))
    socket.listen(8181, '127.0.0.1', () => socket.close(resolve))
  })
  console.log('Inicializando PostgreSQL 16 descartable dentro del proyecto…')
  await database.initialise()
  await database.start()
  await database.createDatabase('service_center_verify')
  const env = {
    ...process.env, SERVICE_CENTER_ENV_FILE: '', NODE_ENV: 'production', PORT: '8181', HOST: '127.0.0.1',
    DATABASE_URL: `postgresql://verify:${pgPassword}@127.0.0.1:${pgPort}/service_center_verify`,
    DATA_DIR: path.join(temporary, 'data'),
    BROWSER_DATA_DIR: path.join(temporary, 'browser'),
    BACKUP_EXPORT_DIR: path.join(temporary, 'exported'),
    JWT_SECRET: randomBytes(48).toString('hex'),
    BACKUP_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    PRINT_BRIDGE_TOKEN: randomBytes(32).toString('hex'),
    INITIAL_ADMIN_PASSWORD: 'admin123',
    VERIFICATION_INSTANCE: 'service-center-isolated-tests',
    PG_BIN_DIR: process.env.PG_BIN_DIR || (process.platform === 'win32' ? path.join(tools, 'pgsql', 'bin') : '/usr/bin'),
  }
  const dump = path.join(env.PG_BIN_DIR, process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump')
  if (!fs.existsSync(dump)) throw new Error('Configurá PG_BIN_DIR con pg_dump y pg_restore de PostgreSQL 16 para verificar respaldos.')
  await startServer(env)
  console.log('Migraciones y arranque de producción correctos. Ejecutando circuito completo…')
  await run(process.execPath, ['--test', 'tests/integration/workflow.mjs'], { ...env, VERIFY_URL: 'http://127.0.0.1:8181' })
  await stopServer()
  await database.createDatabase('service_center_verify_legacy')
  const legacyEnv = { ...env, DATABASE_URL: env.DATABASE_URL.replace('/service_center_verify', '/service_center_verify_legacy') }
  await run(process.execPath, ['server/node_modules/prisma/build/index.js', 'db', 'push', '--schema', 'server/prisma/baseline.prisma', '--skip-generate'], legacyEnv)
  const legacy = database.getPgClient('service_center_verify_legacy')
  await legacy.connect()
  try {
    await legacy.query('INSERT INTO "Customer" (id, "fullName") VALUES ($1, $2)', ['legacy-customer', 'Cliente anterior'])
    await legacy.query('INSERT INTO "Order" (id, "orderNumber", "customerId", brand, model, pin, pattern, price, advance) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', ['legacy-order', 'OS0001', 'legacy-customer', 'Samsung', 'A15', '1234', [0, 1, 2], 15000, 5000])
    await legacy.query('INSERT INTO "User" (id, name, email, password, role, active) VALUES ($1,$2,$3,$4,$5,$6)', ['legacy-admin', 'Admin anterior', 'admin@local.com', bcrypt.hashSync('Legacy-verification-2026', 4), 'admin', true])
    const oldDump = execFileSync(dump, ['--format=custom'], { env: { ...process.env, ...postgresConnection(legacyEnv.DATABASE_URL) }, windowsHide: true, maxBuffer: 256 * 1024 * 1024 })
    const oldBackupName = `db-${Date.now()}.dump`
    fs.writeFileSync(path.join(env.DATA_DIR, 'backups', oldBackupName), encryptBackup(oldDump, env.BACKUP_ENCRYPTION_KEY))
    await startServer(legacyEnv)
    const migration = await legacy.query('SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')
    const customer = await legacy.query('SELECT "fullName" FROM "Customer" WHERE id = $1', ['legacy-customer'])
    if (Number(migration.rows[0].count) !== 2 || customer.rows[0]?.fullName !== 'Cliente anterior') throw new Error('La adopción de la base anterior no conservó los datos.')
    const preserved = (await legacy.query('SELECT pin, pattern, price, advance, "acceptedAt", "rejectedCharge" FROM "Order" WHERE id = $1', ['legacy-order'])).rows[0]
    if (preserved.pin !== '1234' || preserved.price !== 15000 || preserved.advance !== 5000 || JSON.stringify(preserved.pattern) !== '[0,1,2]' || preserved.acceptedAt !== null || preserved.rejectedCharge !== null) throw new Error('La migración alteró una orden anterior.')
    console.log('✓ Adopción de base anterior creada con db push: migración registrada y cliente conservado.')
    const login = await fetch('http://127.0.0.1:8181/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@local.com', password: 'Legacy-verification-2026' }) }).then((response) => response.json())
    const restored = await fetch(`http://127.0.0.1:8181/api/backups/${oldBackupName}/restore`, { method: 'POST', headers: { Authorization: `Bearer ${login.token}` } })
    if (!restored.ok) throw new Error(`Falló restauración de copia anterior: ${JSON.stringify(await restored.json())}`)
    const afterRestore = (await legacy.query('SELECT pin, price, "acceptedAt", "rejectedCharge" FROM "Order" WHERE id = $1', ['legacy-order'])).rows[0]
    if (afterRestore.pin !== '1234' || afterRestore.price !== 15000 || afterRestore.acceptedAt !== null || afterRestore.rejectedCharge !== null) throw new Error('La recuperación de una copia anterior perdió datos.')
    console.log('✓ Restauración cifrada de un esquema anterior: migraciones aplicadas y datos conservados.')

  } finally { await legacy.end() }
  if (process.argv.includes('--ui')) {
    await stopServer()
    await database.createDatabase('service_center_verify_ui')
    await startServer({ ...env, DATABASE_URL: env.DATABASE_URL.replace('/service_center_verify', '/service_center_verify_ui') })
    await run(process.execPath, ['tests/integration/browser.mjs'], { ...env, VERIFY_URL: 'http://127.0.0.1:8181' })
    await run(process.execPath, ['tests/integration/workspace-browser.mjs'], { ...env, VERIFY_URL: 'http://127.0.0.1:8181' })
  }
  if (process.argv.includes('--keep-open') && process.argv.includes('--ui')) {
    console.log('Sistema de revisión: http://127.0.0.1:8181 — base de pruebas aislada. Ctrl+C cierra y elimina este entorno.')
    await new Promise((resolve) => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve) })
  }
  console.log('Verificación real completada. Base y procesos descartables se cerrarán ahora.')
} catch (err) {
  console.error(err.message)
  if (serverLog && !err.message.includes(serverLog)) console.error(serverLog.slice(-12000))
  process.exitCode = 1
} finally {
  await stopServer()
  await database.stop()
  // Verifica el destino antes de eliminar recursivamente en Windows.
  const resolved = path.resolve(temporary)
  if (path.dirname(resolved) === tools && path.basename(resolved).startsWith('verify-')) fs.rmSync(resolved, { recursive: true, force: true })
  else { console.error('Ruta temporal fuera del directorio de pruebas: no se eliminó.'); process.exitCode = 1 }
}
// async-exit-hook (dependencia de embedded-postgres) fija beforeExit en 0.
// Tras cerrar explícitamente todo, preserva el resultado real para CI.
process.exit(process.exitCode || 0)
