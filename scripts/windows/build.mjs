import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { packagePayload } from './package.mjs'
import { root, cache, runtimeLock, downloadRuntimes } from './download.mjs'

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Construir el instalador en Windows x64.')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = process.env.SC_BUILD_VERSION || pkg.version
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('SC_BUILD_VERSION debe ser una versión numérica x.y.z.')
const run = (file, args, options = {}) => execFileSync(file, args, { cwd: root, windowsHide: true, stdio: 'inherit', ...options })
const python = process.env.SC_BUILD_PYTHON || path.join(root, 'tools/build-python/Scripts/python.exe')
const compiler = process.env.MAKENSIS_PATH || path.join(root, 'tools/nsis/makensis.exe')
const payloadOnly = process.argv.includes('--payload-only')
if (!fs.existsSync(python)) throw new Error('Falta tools/build-python. Ver docs/WINDOWS.md.')
const output = path.join(root, 'release')
fs.mkdirSync(output, { recursive: true })
await downloadRuntimes()
if (!payloadOnly && !process.env.MAKENSIS_PATH && !fs.existsSync(compiler)) {
  run('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${path.join(cache, 'nsis.zip').replaceAll("'", "''")}' -DestinationPath '${path.join(root, 'tools/nsis-unpacked').replaceAll("'", "''")}' -Force`])
  fs.cpSync(path.join(root, `tools/nsis-unpacked/nsis-${runtimeLock.compiler.version}`), path.dirname(compiler), { recursive: true })
}
if (!payloadOnly && !fs.existsSync(compiler)) throw new Error('Falta MAKENSIS_PATH o tools/nsis/makensis.exe. Ver docs/WINDOWS.md.')
const tools = path.join(root, 'tools')
const work = fs.mkdtempSync(path.join(tools, 'windows-build-'))
const stage = path.join(work, 'payload')
fs.mkdirSync(stage)
const npmCli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
run(process.execPath, [npmCli, 'run', 'build'])
for (const dir of ['server', 'shared', 'dist', 'docs']) {
  fs.cpSync(path.join(root, dir), path.join(stage, dir), { recursive: true,
    filter: (source) => !['node_modules', 'data', '.env', '__pycache__', 'scripts'].includes(path.basename(source)) && !source.endsWith('.pyc'),
  })
}
fs.mkdirSync(path.join(stage, 'scripts/windows'), { recursive: true })
fs.copyFileSync(path.join(root, 'scripts/windows/service-control.mjs'), path.join(stage, 'scripts/windows/service-control.mjs'))
fs.cpSync(path.join(root, 'installer/windows'), path.join(stage, 'installer/windows'), { recursive: true })
// Windows PowerShell 5.1 necesita BOM para leer correctamente los textos UTF-8.
for (const name of fs.readdirSync(path.join(stage, 'installer/windows')).filter((name) => name.endsWith('.ps1'))) {
  const file = path.join(stage, 'installer/windows', name)
  fs.writeFileSync(file, '\uFEFF' + fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
}
fs.copyFileSync(path.join(root, 'README.md'), path.join(stage, 'README.md'))
fs.copyFileSync(path.join(root, 'package.json'), path.join(stage, 'package.json'))
// npm ci verifica el lockfile. El resultado contiene solo dependencias del servidor.
run(process.execPath, [npmCli, 'ci', '--omit=dev', '--prefix', path.join(stage, 'server')], { env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: 'true' } })
run(process.execPath, [path.join(stage, 'server/node_modules/prisma/build/index.js'), 'generate', '--schema', path.join(stage, 'server/prisma/schema.prisma')])
run(python, [path.join(root, 'scripts/windows/extract-runtime.py'), cache, path.join(stage, 'runtime')])
run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/windows/build-helper.ps1')])
fs.cpSync(path.join(root, 'tools/windows-helper/ServiceCenterPrint'), path.join(stage, 'runtime/printer'), { recursive: true })
await packagePayload(stage, version, { payloadOnly })
