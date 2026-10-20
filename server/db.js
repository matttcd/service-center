// ============================================
// Capa de acceso a datos con Prisma (PostgreSQL)
// ============================================
import './env.js'
import { PrismaClient } from '@prisma/client'

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
