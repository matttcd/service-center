import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { root, runtimeLock, sha256 } from './download.mjs'

export async function packagePayload(stage, version, { payloadOnly = false } = {}) {
  stage = path.resolve(stage)
  if (path.dirname(path.dirname(stage)) !== path.join(root, 'tools') || path.basename(stage) !== 'payload' || !path.basename(path.dirname(stage)).startsWith('windows-build-')) throw new Error('Payload fuera de la carpeta de build.')
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Versión inválida.')
  const output = path.join(root, 'release')
  fs.mkdirSync(output, { recursive: true })
  const files = []
  function inventory(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) inventory(full)
      else if (entry.isFile()) { if (full !== path.join(stage, 'manifest.json')) files.push({ path: path.relative(stage, full).replaceAll('\\', '/'), size: fs.statSync(full).size }) }
      else throw new Error('No se permiten enlaces dentro del paquete.')
    }
  }
  inventory(stage)
  console.log(`Verificando ${files.length} archivos del payload…`)
  let cursor = 0
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (cursor < files.length) {
      const entry = files[cursor++]
      entry.sha256 = await sha256(path.join(stage, entry.path))
    }
  }))
  const releaseId = version + '-' + createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12)
  const manifest = { version, releaseId, platform: 'win32-x64', runtimes: runtimeLock, files }
  fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2))
  const build = { version, releaseId, payload: stage, installer: null }
  fs.writeFileSync(path.join(output, 'last-build.json'), JSON.stringify(build, null, 2))
  if (payloadOnly) { console.log(`Payload Windows verificado por hashes: ${stage}`); return }
  const compiler = process.env.MAKENSIS_PATH || path.join(root, 'tools/nsis/makensis.exe')
  execFileSync(compiler, ['/V2', `/DAppVersion=${version}`, `/DReleaseId=${releaseId}`, `/DStageDir=${stage}`, `/DOutputPath=${output}`, path.join(stage, 'installer/windows/setup.nsi')], { cwd: root, windowsHide: true, stdio: 'inherit' })
  build.installer = path.join(output, `ServiceCenter-Setup-${version}.exe`)
  fs.copyFileSync(path.join(stage, 'manifest.json'), path.join(output, `ServiceCenter-${version}.manifest.json`))
  fs.writeFileSync(build.installer.replace(/\.exe$/, '.sha256'), `${await sha256(build.installer)}  ${path.basename(build.installer)}\n`)
  fs.writeFileSync(path.join(output, 'last-build.json'), JSON.stringify(build, null, 2))
  console.log(`Instalador offline: ${build.installer}`)
  console.log(`Payload para verificación: ${stage}`)
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await packagePayload(process.argv[2], process.argv[3], { payloadOnly: process.argv.includes('--payload-only') })
