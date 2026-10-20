// ============================================
// Seguridad: helpers puros y reutilizables (importables por los tests)
// ============================================
import bcrypt from 'bcryptjs'
import { createHmac } from 'node:crypto'

export function sessionVersion(user, secret) {
  return createHmac('sha256', secret).update(user.password).digest('hex')
}

export function passwordError(password) {
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) {
    return 'La contraseña debe tener al menos 8 caracteres y no superar 72 bytes.'
  }
  if (DEFAULT_PASSWORDS.includes(password)) return 'Elegí una contraseña diferente a la inicial.'
  return null
}

// Contraseñas por defecto que obligan a cambiarlas en el primer ingreso.
export const DEFAULT_PASSWORDS = ['admin123']

// Devuelve un usuario sin datos sensibles (nunca incluye password/hash).
export function publicUser(u) {
  if (!u) return null
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
  }
}

// Indica si el usuario todavía usa una contraseña por defecto.
export function usesDefaultPassword(user) {
  if (!user?.password) return false
  return DEFAULT_PASSWORDS.some((p) => bcrypt.compareSync(p, user.password))
}

// Valida el nombre de un archivo de respaldo (evita path traversal).
export function isValidBackupName(name) {
  return typeof name === 'string' && /^db-[0-9]+\.dump$/.test(name)
}

// Limitador de intentos de login por IP+cuenta (anti fuerza bruta).
// Es estado en memoria y puro respecto de Express, por eso es testeable.
export function createLoginLimiter({ maxAttempts = 5, windowMs = 15 * 60 * 1000 } = {}) {
  maxAttempts = Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : 5
  windowMs = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 15 * 60 * 1000
  const attempts = new Map()

  function prune(now) {
    if (attempts.size <= 10000) return
    for (const [k, r] of attempts) {
      if (now >= r.resetAt) attempts.delete(k)
    }
  }

  return {
    maxAttempts,
    // true si la clave está bloqueada.
    check(key, now = Date.now()) {
      prune(now)
      const rec = attempts.get(key)
      return !!(rec && rec.count >= maxAttempts && now < rec.resetAt)
    },
    note(key, now = Date.now()) {
      const rec = attempts.get(key)
      if (rec && now < rec.resetAt) rec.count += 1
      else attempts.set(key, { count: 1, resetAt: now + windowMs })
    },
    reset(key) {
      attempts.delete(key)
    },
    size() {
      return attempts.size
    },
  }
}
