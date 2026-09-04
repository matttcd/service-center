// ============================================
// Capa de acceso a datos con Prisma (PostgreSQL)
// ============================================
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

// Carga el DATABASE_URL desde .env antes de instanciar Prisma.
// (Necesario aquí: los imports de ESM suben antes que cualquier otro código,
// por eso db.js debe resolver su propia configuración.)
const __file = fileURLToPath(import.meta.url)
const __serverDir = path.dirname(__file)
const __rootDir = path.resolve(__serverDir, '..')
dotenv.config({ path: path.join(__rootDir, '.env') })
dotenv.config({ path: path.join(__serverDir, '.env') })

export const prisma = new PrismaClient()

// Suscriptores que se notifican después de cada mutación (para tiempo real / SSE).
const changeListeners = new Set()

// Registra un callback que se invoca después de cada persistencia.
export function onDataChange(fn) {
  changeListeners.add(fn)
  return () => changeListeners.delete(fn)
}

// Notifica a los suscriptores de que la data cambió.
export function notifyChange() {
  changeListeners.forEach((l) => {
    try {
      l()
    } catch {
      // Un listener con error no debe romper la llamada.
    }
  })
}

// Prisma no expone un close global sencillo; se usa en tests si hace falta.
export async function closeDb() {
  await prisma.$disconnect()
}
