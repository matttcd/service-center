import { createBackup, restoreBackup, listBackups } from './backups.js'
import { prisma } from './db.js'
import { isValidBackupName } from './security.js'
import fs from 'node:fs'
import path from 'node:path'

try {
  const [command, name, confirmation] = process.argv.slice(2)
  if (command === 'create') {
    const created = await createBackup()
    if (!created) throw new Error('No se pudo crear la copia.')
    console.log(JSON.stringify({ name: created }))
  } else if (command === 'list') {
    console.log(JSON.stringify(listBackups()))
  } else if (command === 'restore' && isValidBackupName(name) && confirmation === '--confirm') {
    // Conserva el archivo elegido incluso si la rotación llega al límite.
    const safety = await createBackup({ preserve: name })
    if (!safety) throw new Error('No se pudo respaldar el estado actual. Restauración cancelada.')
    await restoreBackup(name)
    console.log(JSON.stringify({ restored: name, safety }))
  } else if (command === 'import' && isValidBackupName(name)) {
    const dir = path.join(process.env.DATA_DIR || path.resolve('server/data'), 'backups')
    fs.mkdirSync(dir, { recursive: true })
    fs.copyFileSync(`/tmp/${name}`, path.join(dir, name), fs.constants.COPYFILE_EXCL)
    console.log(JSON.stringify({ imported: name }))
  } else {
    throw new Error('Uso: backup-cli.js create | list | restore db-<fecha>.dump --confirm | import db-<fecha>.dump')
  }
} catch (err) {
  console.error(err.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
