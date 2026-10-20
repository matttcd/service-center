import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const probe = spawnSync('docker', ['--version'], { encoding: 'utf8', windowsHide: true })
const useWsl = probe.error?.code === 'ENOENT' && process.platform === 'win32'

export function docker(args, { capture = false, allowFailure = false } = {}) {
  const result = spawnSync(useWsl ? 'wsl' : 'docker', useWsl ? ['--cd', root, '--exec', 'docker', ...args] : args, {
    cwd: root, encoding: 'utf8', windowsHide: true,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })
  if ((result.error || result.status !== 0) && !allowFailure) {
    throw new Error(`Docker falló. Verificá que el motor esté iniciado. ${result.error?.message || ''}`)
  }
  return capture ? result.stdout?.trim() || '' : result.status
}

export function backend(...args) {
  const output = docker(['compose', 'exec', '-T', 'backend', 'node', 'server/backup-cli.js', ...args], { capture: true })
  // dotenv y Prisma pueden agregar mensajes antes del resultado.
  return JSON.parse(output.split(/\r?\n/).filter(Boolean).at(-1))
}
