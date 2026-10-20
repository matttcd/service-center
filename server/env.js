import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import fs from 'node:fs'

const serverDir = path.dirname(fileURLToPath(import.meta.url))
if (process.env.SERVICE_CENTER_ENV_FILE) {
  // La instalación conserva sus secretos fuera del directorio del programa.
  const file = process.env.SERVICE_CENTER_ENV_FILE
  if (file.endsWith('.json')) {
    const values = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
    for (const [key, value] of Object.entries(values)) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(key) || typeof value !== 'string') throw new Error('Configuración del servicio inválida.')
      process.env[key] = value
    }
  } else dotenv.config({ path: file, quiet: true })
} else {
  dotenv.config({ path: path.resolve(serverDir, '../.env'), quiet: true })
  dotenv.config({ path: path.join(serverDir, '.env'), quiet: true })
}
