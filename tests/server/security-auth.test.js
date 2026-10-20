import { describe, expect, it } from 'vitest'
import { createLoginLimiter as makeLimiter, publicUser as sanitizePublicUser } from '../../server/security.js'

// Adaptador de nombres del test; ejecuta el limitador real de producción.
function createLoginLimiter(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  const limiter = makeLimiter({ maxAttempts, windowMs })
  return { checkLoginLimit: limiter.check, noteLoginFailure: limiter.note, resetLoginLimit: limiter.reset }
}

// Lógica de rotación de copias de seguridad (espejo de pruneBackups)
function getBackupsToRemove(fileList, maxBackups = 30) {
  const files = [...fileList].sort() // db-1, db-2...
  const toRemove = []
  while (files.length > maxBackups) {
    toRemove.push(files.shift())
  }
  return { toRemove, remaining: files }
}

describe('Security - Límite de Intentos de Login (Anti Fuerza Bruta)', () => {
  it('permite los primeros 5 intentos fallidos sin bloquear', () => {
    const limiter = createLoginLimiter(5)
    const ip = '192.168.1.100'

    for (let i = 1; i <= 5; i++) {
      limiter.noteLoginFailure(ip)
      if (i < 5) {
        expect(limiter.checkLoginLimit(ip)).toBe(false)
      }
    }
    // Al 5to fallo, el límite fue alcanzado
    expect(limiter.checkLoginLimit(ip)).toBe(true)
  })

  it('bloquea a partir del 5to intento fallido consecutivo', () => {
    const limiter = createLoginLimiter(5)
    const ip = '192.168.1.105'

    for (let i = 0; i < 5; i++) {
      limiter.noteLoginFailure(ip)
    }
    expect(limiter.checkLoginLimit(ip)).toBe(true)
  })

  it('desbloquea automáticamente una vez transcurrida la ventana de 15 minutos', () => {
    const limiter = createLoginLimiter(5, 15 * 60 * 1000)
    const ip = '192.168.1.110'
    const now = 1000000

    for (let i = 0; i < 5; i++) {
      limiter.noteLoginFailure(ip, now)
    }
    expect(limiter.checkLoginLimit(ip, now)).toBe(true)

    // 16 minutos después: la ventana expiró
    const future = now + 16 * 60 * 1000
    expect(limiter.checkLoginLimit(ip, future)).toBe(false)
  })

  it('un login exitoso permite reiniciar el contador de intentos', () => {
    const limiter = createLoginLimiter(5)
    const ip = '192.168.1.120'

    limiter.noteLoginFailure(ip)
    limiter.noteLoginFailure(ip)
    expect(limiter.checkLoginLimit(ip)).toBe(false)

    limiter.resetLoginLimit(ip)
    expect(limiter.checkLoginLimit(ip)).toBe(false)
  })
})

describe('Security - Sanitización de Datos de Usuario (publicUser)', () => {
  it('nunca expone contraseñas, hashes ni campos sensibles', () => {
    const rawUser = {
      id: 'usr-123',
      name: 'Técnico Taller',
      email: 'tech@local.com',
      password: '$2a$10$e8w.hash.super.secreto.bcrypt',
      role: 'tecnico',
      active: true,
      salt: 'salt123',
    }

    const publicData = sanitizePublicUser(rawUser)

    expect(publicData.id).toBe('usr-123')
    expect(publicData.name).toBe('Técnico Taller')
    expect(publicData.email).toBe('tech@local.com')
    expect(publicData.role).toBe('tecnico')
    expect(publicData.active).toBe(true)

    // Aserción crítica de seguridad:
    expect(publicData).not.toHaveProperty('password')
    expect(publicData).not.toHaveProperty('salt')
    expect(publicData.password).toBeUndefined()
  })
})

describe('Security - Rotación y Poda de Respaldos (Pruning)', () => {
  it('no elimina ningún archivo si la cantidad es menor o igual a 30', () => {
    const files = Array.from({ length: 25 }, (_, i) => `db-${1000 + i}.dump`)
    const { toRemove, remaining } = getBackupsToRemove(files, 30)
    expect(toRemove).toEqual([])
    expect(remaining.length).toBe(25)
  })

  it('elimina los archivos más antiguos cuando se superan los 30 respaldos', () => {
    // 35 archivos ordenados cronológicamente
    const files = Array.from({ length: 35 }, (_, i) => `db-${1000 + i}.dump`)
    const { toRemove, remaining } = getBackupsToRemove(files, 30)

    expect(toRemove.length).toBe(5)
    expect(remaining.length).toBe(30)
    // Los eliminados deben ser los 5 primeros (los más viejos)
    expect(toRemove).toEqual(['db-1000.dump', 'db-1001.dump', 'db-1002.dump', 'db-1003.dump', 'db-1004.dump'])
    // Los conservados deben ser los 30 más recientes
    expect(remaining[0]).toBe('db-1005.dump')
    expect(remaining[remaining.length - 1]).toBe('db-1034.dump')
  })
})
