import { createBackup, restoreBackup, listBackups, BACKUP_DIR, BACKUP_ENCRYPTION_KEY } from './backups.js'
import { decryptBackup, encryptBackup } from './backup-crypto.js'
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
  } else if (command === 'restore-file' && name && confirmation === '--confirm') {
    // La clave de otra instalación entra por stdin, nunca en argumentos ni logs.
    let input = ''
    for await (const chunk of process.stdin) { input += chunk; if (input.length > 4096) throw new Error('Clave inválida.') }
    const key = JSON.parse(input).key
    const full = path.resolve(name)
    if (fs.statSync(full).size > 256 * 1024 * 1024) throw new Error('El respaldo supera el máximo de 256 MiB.')
    const bytes = fs.readFileSync(full)
    const plaintext = decryptBackup(bytes, key)
    const safety = await createBackup()
    if (!safety) throw new Error('No se pudo respaldar el estado actual. Restauración cancelada.')
    const imported = `db-${Date.now() + 1}.dump`
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    // La copia adoptada usa la clave del destino y queda recuperable desde su UI.
    fs.writeFileSync(path.join(BACKUP_DIR, imported), encryptBackup(plaintext, BACKUP_ENCRYPTION_KEY), { mode: 0o600, flag: 'wx' })
    await restoreBackup(imported)
    console.log(JSON.stringify({ restored: imported, safety }))
  } else if (command === 'import' && isValidBackupName(name)) {
    const dir = path.join(process.env.DATA_DIR || path.resolve('server/data'), 'backups')
    fs.mkdirSync(dir, { recursive: true })
    fs.copyFileSync(`/tmp/${name}`, path.join(dir, name), fs.constants.COPYFILE_EXCL)
    console.log(JSON.stringify({ imported: name }))
  } else {
    throw new Error('Uso: backup-cli.js create | list | restore db-<fecha>.dump --confirm | restore-file ruta --confirm | import db-<fecha>.dump')
  }
} catch (err) {
  console.error(err.message)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
