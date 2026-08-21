// ============================================
// Persistencia en un archivo JSON (base de datos central)
// ============================================
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'db.json')

let db = null
let writeQueue = Promise.resolve()

// Máxima cantidad de entradas de auditoría a conservar (se poda el excedente).
const MAX_AUDIT = Number(process.env.MAX_AUDIT || 5000)

// Suscriptores que se notifican cuando la base cambia (para tiempo real).
const changeListeners = new Set()

// Registra un callback que se invoca después de cada persistencia.
export function onDataChange(fn) {
  changeListeners.add(fn)
  return () => changeListeners.delete(fn)
}

// Inicializa la base de datos. Si no existe el archivo, crea el seed.
export async function initDB(seed) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  } catch {
    db = seed()
    await persist()
  }
  return db
}

// Devuelve la base de datos en memoria.
export function getDB() {
  return db
}

// Persiste de forma atómica (escribe temporal y renombra).
export function persist() {
  writeQueue = writeQueue.then(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const tmp = DB_FILE + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2))
    atomicReplace(tmp, DB_FILE)
  })
  return writeQueue
}

// Reemplaza un archivo de forma atómica. En Windows el rename puede fallar con
// EPERM si el destino está momentáneamente bloqueado (antivirus u otra
// instancia): reintenta y, si sigue fallando, copia encima como respaldo.
function atomicReplace(tmp, dest) {
  for (let i = 0; i < 5; i++) {
    try {
      fs.renameSync(tmp, dest)
      return
    } catch (err) {
      if (i === 4) throw err
      try {
        fs.copyFileSync(tmp, dest)
        fs.unlinkSync(tmp)
        return
      } catch {
        // Reintenta con el rename.
      }
    }
    const waitMs = 50 * (i + 1)
    const sab = new Int32Array(new SharedArrayBuffer(4))
    Atomics.wait(sab, 0, 0, waitMs)
  }
}

// Aplica una mutación a la base y la persiste.
export function mutate(fn) {
  const result = fn(db)
  // Poda la auditoría para que el archivo no crezca sin límite.
  if (db.auditLogs && db.auditLogs.length > MAX_AUDIT) {
    db.auditLogs = db.auditLogs.slice(-MAX_AUDIT)
  }
  return persist().then(() => {
    changeListeners.forEach((l) => {
      try {
        l()
      } catch {
        // Un listener con error no debe romper la mutación.
      }
    })
    return result
  })
}

// ============================================
// Copias de seguridad (backups) + rollback
// ============================================

const MAX_BACKUPS = Number(process.env.MAX_BACKUPS || 30)

function backupDir() {
  return path.join(DATA_DIR, 'backups')
}

// Crea una copia del estado actual de la base (atómico).
// Devuelve el nombre del archivo creado o null si aún no hay base.
export function createBackup() {
  if (!db) return null
  const dir = backupDir()
  fs.mkdirSync(dir, { recursive: true })
  const name = `db-${Date.now()}.json`
  const tmp = path.join(dir, name + '.tmp')
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2))
  atomicReplace(tmp, path.join(dir, name))
  pruneBackups()
  return name
}

// Lista las copias disponibles (ordenadas de más reciente a más antigua).
export function listBackups() {
  const dir = backupDir()
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => /^db-[0-9]+\.json$/.test(f))
      .map((name) => {
        const st = fs.statSync(path.join(dir, name))
        return { name, size: st.size, mtime: st.mtime.toISOString() }
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime))
  } catch {
    return []
  }
}

// Restaura la base desde una copia. Valida el contenido antes de aplicarla.
export async function restoreBackup(name) {
  const dir = backupDir()
  if (!/^db-[0-9]+\.json$/.test(name)) throw new Error('Nombre de copia inválido.')
  const full = path.join(dir, name)
  if (!fs.existsSync(full)) throw new Error('Copia no encontrada.')
  const data = JSON.parse(fs.readFileSync(full, 'utf8'))
  if (!data || !Array.isArray(data.customers) || !Array.isArray(data.users)) {
    throw new Error('La copia no es válida.')
  }
  db = data
  await persist()
  return true
}

// ============================================
// Papelera (borrado suave) + purga definitiva
// ============================================

// Elimina definitivamente (purga) todo lo que lleva más de maxDays en la
// papelera (marcado con deletedAt). Devuelve cuántos registros se purgaron.
export function purgeTrash(maxDays) {
  if (!db) return { customers: 0, orders: 0 }
  const cutoff = Date.now() - maxDays * 86400000
  const old = (r) => r.deletedAt && new Date(r.deletedAt).getTime() < cutoff

  const beforeCustomers = db.customers.length
  const beforeOrders = db.orders.length

  const custIds = db.customers.filter(old).map((c) => c.id)
  const orderIds = db.orders.filter(old).map((o) => o.id)

  db.customers = db.customers.filter((c) => !custIds.includes(c.id))
  db.orders = db.orders.filter((o) => !orderIds.includes(o.id) && !custIds.includes(o.customerId))

  return {
    customers: beforeCustomers - db.customers.length,
    orders: beforeOrders - db.orders.length,
  }
}

// Elimina las copias más viejas hasta dejar MAX_BACKUPS.
function pruneBackups() {
  const dir = backupDir()
  let files
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => /^db-[0-9]+\.json$/.test(f))
      .sort()
  } catch {
    return
  }
  while (files.length > MAX_BACKUPS) {
    const toRemove = files.shift()
    try {
      fs.unlinkSync(path.join(dir, toRemove))
    } catch {
      // Ignora errores de borrado.
    }
  }
}