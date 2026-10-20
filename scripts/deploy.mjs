import './setup-env.mjs'
import { docker } from './docker.mjs'
import { exportBackup } from './backup.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { root } from './docker.mjs'

const env = fs.readFileSync(path.join(root, '.env'), 'utf8')
const compose = /^ENABLE_HTTPS=1\s*$/m.test(env) ? ['compose', '--profile', 'https'] : ['compose']

try {
  docker([...compose, 'config', '--quiet'])
  const running = docker(['compose', 'ps', '--status', 'running', '-q', 'backend'], { capture: true })
  if (running) exportBackup()
  docker([...compose, 'build'])
  docker([...compose, 'up', '-d', '--wait', '--wait-timeout', '180'])
  docker([...compose, 'ps'])
  const port = /^APP_PORT=(\d+)/m.exec(env)?.[1] || '8081'
  const host = /^APP_HOST=(.+)/m.exec(env)?.[1]?.trim() || 'localhost'
  console.log(compose.includes('https') ? `Sistema listo: https://${host} (requiere confiar en el certificado local).` : `Sistema listo: http://localhost:${port}`)
} catch (err) {
  console.error(`Despliegue detenido: ${err.message}`)
  console.error('Revisá docker compose logs --tail=100 backend. Los volúmenes se conservan.')
  process.exitCode = 1
}
