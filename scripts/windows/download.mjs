import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const cache = path.join(root, 'tools/windows-cache')
const lockFile = path.join(root, 'installer/windows/runtime-lock.json')
export const runtimeLock = JSON.parse(fs.readFileSync(lockFile, 'utf8'))
export async function sha256(file) {
  const hash = createHash('sha256')
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}
export async function downloadRuntimes({ recordHashes = false } = {}) {
  fs.mkdirSync(cache, { recursive: true })
  // Descargar versiones nuevas es una tarea explícita del mantenedor; el build
  // normal nunca acepta un archivo sin checksum ni consulta "latest".
  for (const [name, item] of Object.entries(runtimeLock)) {
    if (path.basename(item.file) !== item.file || !item.url.startsWith('https://')) throw new Error('Manifiesto de runtimes inválido.')
    if (!item.sha256 && !recordHashes) throw new Error(`Falta SHA-256 para ${name}. Revisá y fijá el manifiesto antes de construir.`)
    const target = path.join(cache, item.file)
    if (!fs.existsSync(target)) {
      console.log(`Descargando ${name} ${item.version}…`)
      const response = await fetch(item.url, { signal: AbortSignal.timeout(300000) })
      if (!response.ok) throw new Error(`No se pudo descargar ${name}: HTTP ${response.status}`)
      await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(`${target}.part`))
      fs.renameSync(`${target}.part`, target)
    }
    const checksum = await sha256(target)
    if (item.sha256 && checksum !== item.sha256) throw new Error(`Checksum incorrecto para ${name}; no se usará el archivo.`)
    if (!item.sha256 && recordHashes) item.sha256 = checksum
    console.log(`✓ ${name}: SHA-256 verificado`)
  }
  if (recordHashes) fs.writeFileSync(lockFile, JSON.stringify(runtimeLock, null, 2) + '\n')
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await downloadRuntimes({ recordHashes: process.argv.includes('--record-hashes') })
