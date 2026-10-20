import fs from 'node:fs'
import path from 'node:path'
import { docker, backend, root } from './docker.mjs'
import { pathToFileURL } from 'node:url'

export function exportBackup() {
  const result = backend('create')
  const dir = path.join(root, 'backups')
  fs.mkdirSync(dir, { recursive: true })
  docker(['compose', 'cp', `backend:/app/data/backups/${result.name}`, `./backups/${result.name}`])
  const target = path.join(dir, result.name)
  if (!fs.statSync(target).size) throw new Error('La copia exportada está vacía.')
  console.log(`Respaldo cifrado exportado: ${target}`)
  return target
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { exportBackup() } catch (err) { console.error(err.message); process.exitCode = 1 }
}
