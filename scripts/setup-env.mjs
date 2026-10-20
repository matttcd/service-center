import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const filename = path.join(root, '.env')
let text = fs.existsSync(filename) ? fs.readFileSync(filename, 'utf8') : ''
const values = {
  PG_PASSWORD: () => randomBytes(24).toString('hex'),
  JWT_SECRET: () => randomBytes(48).toString('hex'),
  BACKUP_ENCRYPTION_KEY: () => randomBytes(32).toString('hex'),
  PRINT_BRIDGE_TOKEN: () => randomBytes(32).toString('hex'),
  APP_BIND_IP: () => '127.0.0.1',
  APP_PORT: () => '8081',
}
let added = 0
for (const [name, generate] of Object.entries(values)) {
  const existing = new RegExp(`^${name}=(.+)`, 'm').exec(text)?.[1]?.trim()
  if (existing && !(name === 'JWT_SECRET' && existing.length < 32)) continue
  text = text.replace(new RegExp(`^${name}=.*\\r?\\n?`, 'm'), '')
  text += `${text.endsWith('\n') || !text ? '' : '\n'}${name}=${generate()}\n`
  added++
}
fs.writeFileSync(filename, text, { mode: 0o600 })
console.log(`Configuración preparada (${added} valores agregados). Los secretos no se muestran ni se suben a Git.`)
console.log('Guardá una copia segura del .env fuera de esta PC: BACKUP_ENCRYPTION_KEY es necesaria para recuperar las copias.')
