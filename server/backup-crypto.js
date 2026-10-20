import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const MAGIC = Buffer.from('SCBACKUP1')

export function backupKey(value) {
  if (!/^[a-f0-9]{64}$/i.test(value || '')) throw new Error('BACKUP_ENCRYPTION_KEY debe contener 64 caracteres hexadecimales.')
  return Buffer.from(value, 'hex')
}

export function encryptBackup(data, key) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', backupKey(key), iv)
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted])
}

export function decryptBackup(data, key) {
  // Compatibilidad de lectura con los respaldos anteriores de pg_dump.
  if (data.subarray(0, 5).toString() === 'PGDMP') return data
  if (!data.subarray(0, MAGIC.length).equals(MAGIC) || data.length < MAGIC.length + 28) {
    throw new Error('El archivo no es un respaldo válido.')
  }
  try {
    const offset = MAGIC.length
    const decipher = createDecipheriv('aes-256-gcm', backupKey(key), data.subarray(offset, offset + 12))
    decipher.setAuthTag(data.subarray(offset + 12, offset + 28))
    return Buffer.concat([decipher.update(data.subarray(offset + 28)), decipher.final()])
  } catch {
    throw new Error('No se pudo verificar el respaldo: la clave es incorrecta o el archivo está dañado.')
  }
}

export function postgresConnection(databaseUrl) {
  const url = new URL(databaseUrl)
  url.searchParams.delete('schema')
  // Las credenciales van en el entorno del proceso, nunca en sus argumentos.
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    ...(url.searchParams.has('sslmode') ? { PGSSLMODE: url.searchParams.get('sslmode') } : {}),
  }
}
