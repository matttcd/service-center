// Solo respaldo: usa los runtimes del instalador si los anteriores se retiraron.
import './env.js'
import fs from 'node:fs'
import path from 'node:path'
const pgBin = process.argv[2]
if (process.platform !== 'win32' || !process.env.SERVICE_CENTER_ENV_FILE || !pgBin || !path.isAbsolute(pgBin) || !fs.existsSync(path.join(pgBin, 'pg_dump.exe'))) throw new Error('Falta el runtime de respaldo del instalador.')
process.env.PG_BIN_DIR = pgBin
process.argv = [process.execPath, process.argv[1], 'create']
await import('./backup-cli.js')
