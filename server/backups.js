import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { prisma, notifyChange } from './db.js'
import { isValidBackupName } from './security.js'
import { backupKey, encryptBackup, decryptBackup, postgresConnection } from './backup-crypto.js'

const serverDir = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(serverDir, 'data')
export const BACKUP_DIR = path.join(DATA_DIR, 'backups')
export const BACKUP_ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY
const NODE_ENV = process.env.NODE_ENV || 'development'
const EXPORT_DIR = process.env.BACKUP_EXPORT_DIR || ''
const status = { lastAttemptAt: null, lastSuccessAt: null, lastError: null, exportLastSuccessAt: null, exportError: null }
let restoring = false
let lastBackupStamp = 0
export const isRestoring = () => restoring
export function getBackupStatus() {
  return { ...status, lastSuccessAt: status.lastSuccessAt || listBackups()[0]?.mtime || null, exportConfigured: !!EXPORT_DIR }
}

// ---------- Copias de seguridad (solo admin) ----------
// Localiza el ejecutable de PostgreSQL (pg_dump / pg_restore) en PATH o en rutas estándar de Windows.
function findPgBinary(binName) {
  const exe = process.platform === 'win32' ? `${binName}.exe` : binName
  if (process.env.PG_BIN_DIR) return path.join(process.env.PG_BIN_DIR, exe)
  if (process.platform === 'win32') {
    const versions = ['16', '17', '18', '15', '14', '13', '12']
    const roots = [
      process.env['ProgramFiles'] || 'C:\\Program Files',
      process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    ]
    for (const root of roots) {
      for (const ver of versions) {
        const full = path.join(root, 'PostgreSQL', ver, 'bin', exe)
        if (fs.existsSync(full)) return full
      }
    }
  }
  return binName
}

function runPgDump() {
  const bin = findPgBinary('pg_dump')
  const env = { ...process.env, ...postgresConnection(process.env.DATABASE_URL) }
  return new Promise((resolve, reject) => {
    // 1. Intenta ejecutar pg_dump directamente (ej: en host con PostgreSQL o contenedor con postgresql-client)
    execFile(bin, ['--format=custom'], { env, windowsHide: true, maxBuffer: 1024 * 1024 * 256, encoding: 'buffer' }, (err, stdout) => {
      if (!err && stdout && stdout.length > 0) {
        return resolve(stdout)
      }
      reject(new Error(err?.code === 'ENOENT' ? 'No se encontró pg_dump. Configurá PG_BIN_DIR con las herramientas de PostgreSQL.' : 'pg_dump no pudo crear la copia. Revisá la conexión y la versión del cliente PostgreSQL.'))
    })
  })
}

export async function createBackup({ preserve } = {}) {
  status.lastAttemptAt = new Date().toISOString()
  const dir = BACKUP_DIR
  fs.mkdirSync(dir, { recursive: true })
  lastBackupStamp = Math.max(Date.now(), lastBackupStamp + 1)
  const name = `db-${lastBackupStamp}.dump`
  try {
    if (NODE_ENV === 'production') backupKey(BACKUP_ENCRYPTION_KEY)
    const buffer = await runPgDump()
    if (!buffer.subarray(0, 5).equals(Buffer.from('PGDMP'))) throw new Error('pg_dump no generó un respaldo válido.')
    const data = BACKUP_ENCRYPTION_KEY ? encryptBackup(buffer, BACKUP_ENCRYPTION_KEY) : buffer
    const temporary = path.join(dir, `${name}.tmp`)
    fs.writeFileSync(temporary, data, { mode: 0o600 })
    fs.renameSync(temporary, path.join(dir, name))
    status.lastSuccessAt = new Date().toISOString()
    status.lastError = null
    if (EXPORT_DIR) {
      try {
        fs.mkdirSync(EXPORT_DIR, { recursive: true })
        const exported = path.join(EXPORT_DIR, name)
        fs.copyFileSync(path.join(dir, name), `${exported}.tmp`)
        fs.renameSync(`${exported}.tmp`, exported)
        status.exportLastSuccessAt = new Date().toISOString()
        status.exportError = null
        const copies = fs.readdirSync(EXPORT_DIR).filter(isValidBackupName).sort().reverse()
        const keep = Math.max(2, Math.floor(Number(process.env.MAX_EXPORTED_BACKUPS) || 90))
        for (const old of copies.slice(keep)) fs.unlinkSync(path.join(EXPORT_DIR, old))
      } catch {
        status.exportError = 'La copia interna se creó, pero no se pudo exportar fuera de Docker. Revisá el destino y sus permisos.'
        console.error(status.exportError)
      }
    }
    pruneBackups(preserve)
    return name
  } catch (e) {
    status.lastError = e.message
    console.error('Error creando backup:', e.message)
    return null
  }
}

export function listBackups() {
  try {
    return fs
      .readdirSync(BACKUP_DIR)
      .filter(isValidBackupName)
      .map((name) => {
        const st = fs.statSync(path.join(BACKUP_DIR, name))
        return { name, size: st.size, mtime: st.mtime.toISOString() }
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime))
  } catch {
    return []
  }
}

const MAX_BACKUPS = Math.max(2, Math.floor(Number(process.env.MAX_BACKUPS) || 30))
function pruneBackups(preserve) {
  const files = listBackups().map((b) => b.name).filter((name) => name !== preserve).sort()
  while (files.length > MAX_BACKUPS) {
    const toRemove = files.shift()
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, toRemove))
    } catch {
      // ignora errores
    }
  }
}

export async function restoreBackup(name) {
  if (restoring) throw new Error('Ya hay una restauración en curso.')
  if (!isValidBackupName(name)) throw new Error('Nombre de copia inválido.')
  const full = path.join(BACKUP_DIR, name)
  if (!fs.existsSync(full)) throw new Error('Copia no encontrada.')
  // Autentica y descifra ANTES de ejecutar cualquier operación sobre la base.
  const data = decryptBackup(fs.readFileSync(full), BACKUP_ENCRYPTION_KEY)
  const env = { ...process.env, ...postgresConnection(process.env.DATABASE_URL) }
  const bin = findPgBinary('pg_restore')
  restoring = true
  try {
    await new Promise((resolve, reject) => {
    // 1. Intenta ejecutar pg_restore directamente
    const args = ['--single-transaction', '--clean', '--if-exists', '--no-owner', '--no-privileges', '--dbname', env.PGDATABASE]
    const child = execFile(bin, args, { env, windowsHide: true }, (err) => {
      if (!err) return resolve()
      reject(new Error(err.code === 'ENOENT' ? 'No se encontró pg_restore. Configurá PG_BIN_DIR.' : 'No se pudo restaurar la copia. La transacción fue cancelada.'))
    })
    child.on('error', () => {
      // En caso de que falle por spawn error, el callback de execFile maneja el fallback
    })
    child.stdin.on('error', () => {})
    child.stdin.end(data)
    })
  } finally { restoring = false }
  notifyChange()
  return true
}

// Copias de seguridad automáticas
const BACKUP_HOUR = Number(process.env.BACKUP_HOUR ?? 3)
const PAPELERA_RETENTION_DAYS = Number(process.env.PAPELERA_RETENTION_DAYS ?? 30)

export function scheduleBackups() {
  const run = async () => {
    try {
      const name = await createBackup()
      if (name) console.log(`Copia de seguridad creada: ${name}`)
    } catch (e) {
      console.error('No se pudo crear la copia de seguridad:', e)
    }
    try {
      const cutoff = new Date(Date.now() - PAPELERA_RETENTION_DAYS * 86400000)
      await prisma.$transaction([
        prisma.order.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
        prisma.customer.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
      ])
      console.log(`Papelera: purgados registros antiguos.`)
    } catch (e) {
      console.error('No se pudo purgar la papelera:', e)
    }
  }
  const arm = () => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(BACKUP_HOUR, 0, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    setTimeout(() => {
      run()
      arm()
    }, next - now)
  }
  run()
  arm()
}
