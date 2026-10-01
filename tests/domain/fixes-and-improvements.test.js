import { describe, expect, it } from 'vitest'

// ============================================================
// 1. Lógica de validación de DNI para Clientes
// ============================================================
function validateCustomerDni(dni, existingCustomers = [], currentCustomerId = null) {
  const dniNorm = String(dni || '').trim()
  if (dniNorm && !/^\d{6,8}$/.test(dniNorm)) {
    return { valid: false, error: 'El DNI debe tener entre 6 y 8 dígitos.' }
  }

  // Solución crítica: solo verificar duplicados si dniNorm NO está vacío
  if (dniNorm) {
    const dup = existingCustomers.find(
      (c) => !c.deletedAt && c.dni === dniNorm && (!currentCustomerId || c.id !== currentCustomerId)
    )
    if (dup) {
      return { valid: false, error: `Ya existe un cliente con el DNI ${dniNorm}.` }
    }
  }

  return { valid: true, error: null, dniNorm }
}

describe('Validación de DNI y Clientes (Corrección de DNI vacío)', () => {
  it('permite crear cliente sin DNI (cadena vacía o undefined)', () => {
    const res1 = validateCustomerDni('', [])
    expect(res1.valid).toBe(true)
    expect(res1.dniNorm).toBe('')

    const res2 = validateCustomerDni(undefined, [])
    expect(res2.valid).toBe(true)
    expect(res2.dniNorm).toBe('')
  })

  it('permite crear MÚLTIPLES clientes sin DNI sin conflicto por duplicado', () => {
    const existing = [
      { id: 'c1', fullName: 'Cliente Uno', dni: '', deletedAt: null },
      { id: 'c2', fullName: 'Cliente Dos', dni: '', deletedAt: null },
    ]

    const res = validateCustomerDni('', existing)
    expect(res.valid).toBe(true)
    expect(res.error).toBeNull()
  })

  it('rechaza DNIs con formato inválido (menos de 6 o más de 8 dígitos, o letras)', () => {
    expect(validateCustomerDni('12345').valid).toBe(false)
    expect(validateCustomerDni('123456789').valid).toBe(false)
    expect(validateCustomerDni('30ABC123').valid).toBe(false)
  })

  it('detecta duplicados cuando se ingresa un DNI ya existente en cliente activo', () => {
    const existing = [
      { id: 'c1', fullName: 'Juan Perez', dni: '32456789', deletedAt: null },
    ]
    const res = validateCustomerDni('32456789', existing)
    expect(res.valid).toBe(false)
    expect(res.error).toContain('Ya existe un cliente con el DNI 32456789')
  })

  it('no da conflicto al actualizar el mismo cliente manteniendo su DNI', () => {
    const existing = [
      { id: 'c1', fullName: 'Juan Perez', dni: '32456789', deletedAt: null },
    ]
    const res = validateCustomerDni('32456789', existing, 'c1')
    expect(res.valid).toBe(true)
  })

  it('ignora clientes eliminados (soft-deleted) al verificar duplicados', () => {
    const existing = [
      { id: 'c1', fullName: 'Cliente Borrado', dni: '32456789', deletedAt: new Date() },
    ]
    const res = validateCustomerDni('32456789', existing)
    expect(res.valid).toBe(true)
  })
})

// ============================================================
// 2. Permisos de Administrador y Técnico en Edición de Órdenes
// ============================================================
function checkCanEditOrderTechnicalFields(user, order) {
  const isAssignedTech = (user.role === 'tecnico' && order.assignedTo === user.id) || user.role === 'admin'
  return {
    canEdit: isAssignedTech,
    role: user.role,
    isAssignedTech,
  }
}

describe('Permisos en PUT /api/orders/:id (isAssignedTech ampliado a Admin)', () => {
  const order = { id: 'ord-1', assignedTo: 'tech-1', status: 'en_reparacion' }

  it('permite al técnico asignado editar notas y arreglos técnicos', () => {
    const techAssigned = { id: 'tech-1', role: 'tecnico' }
    const result = checkCanEditOrderTechnicalFields(techAssigned, order)
    expect(result.canEdit).toBe(true)
    expect(result.isAssignedTech).toBe(true)
  })

  it('NO permite a un técnico distinto al asignado modificar notas técnicas', () => {
    const techOther = { id: 'tech-2', role: 'tecnico' }
    const result = checkCanEditOrderTechnicalFields(techOther, order)
    expect(result.canEdit).toBe(false)
    expect(result.isAssignedTech).toBe(false)
  })

  it('PERMITE a un Administrador editar notas técnicas y repuestos de cualquier orden', () => {
    const admin = { id: 'admin-1', role: 'admin' }
    const result = checkCanEditOrderTechnicalFields(admin, order)
    expect(result.canEdit).toBe(true)
    expect(result.isAssignedTech).toBe(true)
  })

  it('permite a un Administrador intervenir aun cuando la orden no tenga técnico asignado', () => {
    const unassignedOrder = { id: 'ord-2', assignedTo: null, status: 'presupuesto' }
    const admin = { id: 'admin-1', role: 'admin' }
    const result = checkCanEditOrderTechnicalFields(admin, unassignedOrder)
    expect(result.canEdit).toBe(true)
  })

  it('NO permite al rol recepcion editar notas técnicas de taller', () => {
    const recepcion = { id: 'rec-1', role: 'recepcion' }
    const result = checkCanEditOrderTechnicalFields(recepcion, order)
    expect(result.canEdit).toBe(false)
  })
})

// ============================================================
// 3. Exportación CSV y compatibilidad con Excel (UTF-8 BOM)
// ============================================================
function escapeCsvValue(val) {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function generateOrdersCsv(orders) {
  const headers = ['Nro Orden', 'Fecha', 'Cliente', 'Equipo', 'Estado', 'Presupuesto', 'Seña', 'Saldo']
  const rows = orders.map((o) => {
    const p = Math.max(0, Number(o.price) || 0)
    const a = Math.max(0, Number(o.advance) || 0)
    const saldo = Math.max(0, p - a)
    return [
      escapeCsvValue(o.orderNumber),
      escapeCsvValue(o.createdAt?.slice(0, 10) || ''),
      escapeCsvValue(o.customerName),
      escapeCsvValue(`${o.brand || ''} ${o.model || ''}`.trim()),
      escapeCsvValue(o.status),
      p,
      a,
      saldo,
    ].join(',')
  })
  return '\uFEFF' + [headers.join(','), ...rows].join('\n')
}

describe('Exportación CSV con formato compatible y caracteres especiales', () => {
  it('escapa comillas dobles, comas y saltos de línea correctamente', () => {
    expect(escapeCsvValue('Simple')).toBe('Simple')
    expect(escapeCsvValue('Pérez, Juan')).toBe('"Pérez, Juan"')
    expect(escapeCsvValue('Pantalla "OLED"')).toBe('"Pantalla ""OLED"""')
    expect(escapeCsvValue('Línea 1\nLínea 2')).toBe('"Línea 1\nLínea 2"')
  })

  it('antepone el marcador UTF-8 BOM (\\uFEFF) para visualización correcta en Excel', () => {
    const csv = generateOrdersCsv([])
    expect(csv.startsWith('\uFEFF')).toBe(true)
  })

  it('calcula saldos pendientes y formatea filas de órdenes adecuadamente', () => {
    const orders = [
      {
        orderNumber: '001042',
        createdAt: '2026-09-27T10:00:00.000Z',
        customerName: 'Gómez, Martín "Tincho"',
        brand: 'Apple',
        model: 'iPhone 13 Pro',
        status: 'en_reparacion',
        price: 85000,
        advance: 30000,
      },
    ]

    const csv = generateOrdersCsv(orders)
    expect(csv).toContain('001042,2026-09-27,"Gómez, Martín ""Tincho""",Apple iPhone 13 Pro,en_reparacion,85000,30000,55000')
  })
})

// ============================================================
// 4. Seguridad de Descargas de Respaldos (Path Traversal Prevention)
// ============================================================
function sanitizeBackupFileName(name) {
  if (!name || typeof name !== 'string') return null
  // No permitir rutas relativas ni caracteres de escape
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return null
  if (!/^[\w.-]+\.(json|dump)$/i.test(name)) return null
  return name
}

describe('Sanitización de nombres de respaldo en descargas', () => {
  it('permite nombres válidos de backups (.json y .dump)', () => {
    expect(sanitizeBackupFileName('backup-2026-09-27-pg.dump')).toBe('backup-2026-09-27-pg.dump')
    expect(sanitizeBackupFileName('backup-full.json')).toBe('backup-full.json')
  })

  it('bloquea intentos de Path Traversal (../, barras)', () => {
    expect(sanitizeBackupFileName('../../etc/passwd')).toBeNull()
    expect(sanitizeBackupFileName('..\\windows\\win.ini')).toBeNull()
    expect(sanitizeBackupFileName('subfolder/backup.dump')).toBeNull()
  })

  it('bloquea extensiones no permitidas', () => {
    expect(sanitizeBackupFileName('backup.exe')).toBeNull()
    expect(sanitizeBackupFileName('script.sh')).toBeNull()
  })
})

// ============================================================
// 5. Verificación de Expiración de Token JWT (Evita flash de la página)
// ============================================================
import { isTokenExpired } from '../../src/utils/storage.js'

describe('Verificación de expiración de sesión (isTokenExpired)', () => {
  function makeMockToken(expSeconds) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ id: 'u1', role: 'admin', exp: expSeconds })).toString('base64url')
    return `${header}.${payload}.mockSignature`
  }

  it('detecta un token vencido (exp en el pasado)', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600 // 1 hora atrás
    const token = makeMockToken(pastExp)
    expect(isTokenExpired(token)).toBe(true)
  })

  it('detecta un token activo (exp en el futuro)', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600 // 1 hora en el futuro
    const token = makeMockToken(futureExp)
    expect(isTokenExpired(token)).toBe(false)
  })

  it('trata tokens malformados, vacíos o nulos como expirados', () => {
    expect(isTokenExpired('')).toBe(true)
    expect(isTokenExpired(null)).toBe(true)
    expect(isTokenExpired('not-a-token')).toBe(true)
    expect(isTokenExpired('a.b')).toBe(true)
  })
})

