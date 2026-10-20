import { describe, it, expect } from 'vitest'
import { backupKey, encryptBackup, decryptBackup, postgresConnection } from '../../server/backup-crypto.js'
import { sessionVersion, passwordError } from '../../server/security.js'

const key = '1a'.repeat(32)
const original = Buffer.from('PGDMP datos sensibles de clientes y órdenes')
describe('respaldos cifrados', () => {
  it('recupera los bytes originales y usa un IV distinto en cada copia', () => {
    const first = encryptBackup(original, key)
    const second = encryptBackup(original, key)
    expect(first.equals(second)).toBe(false)
    expect(first.includes(original)).toBe(false)
    expect(decryptBackup(first, key)).toEqual(original)
  })
  it('rechaza una clave incorrecta antes de restaurar', () => {
    expect(() => decryptBackup(encryptBackup(original, key), '2b'.repeat(32))).toThrow('clave es incorrecta')
  })
  it('detecta alteraciones y archivos truncados', () => {
    const damaged = encryptBackup(original, key)
    damaged[damaged.length - 1] ^= 1
    expect(() => decryptBackup(damaged, key)).toThrow('dañado')
    expect(() => decryptBackup(damaged.subarray(0, 20), key)).toThrow('válido')
  })
  it('puede leer respaldos históricos de pg_dump', () => {
    expect(decryptBackup(original)).toEqual(original)
    expect(() => decryptBackup(Buffer.from('texto ajeno'), key)).toThrow('válido')
  })
  it('exige una clave AES de 256 bits', () => {
    expect(() => backupKey('abc')).toThrow()
    expect(backupKey(key)).toHaveLength(32)
  })
  it('separa las credenciales de los argumentos de PostgreSQL', () => {
    expect(postgresConnection('postgresql://user:p%40ss@localhost:55432/db?schema=public&sslmode=require')).toEqual({
      PGHOST: 'localhost', PGPORT: '55432', PGDATABASE: 'db', PGUSER: 'user', PGPASSWORD: 'p@ss', PGSSLMODE: 'require',
    })
  })
})
describe('contraseñas y sesiones', () => {
  it('el cambio de contraseña invalida la versión del token anterior', () => {
    expect(sessionVersion({ password: 'hash1' }, 'secret')).not.toBe(sessionVersion({ password: 'hash2' }, 'secret'))
  })
  it('rechaza contraseñas débiles y el truncamiento de bcrypt', () => {
    expect(passwordError('1234')).toBeTruthy()
    expect(passwordError('admin123')).toBeTruthy()
    expect(passwordError('á'.repeat(37))).toBeTruthy()
    expect(passwordError('una contraseña segura')).toBeNull()
  })
})
