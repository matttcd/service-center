import fs from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { docker, backend, root } from './docker.mjs'
const isValidBackupName = (name) => /^db-[0-9]+\.dump$/.test(name)

const prompt = createInterface({ input: stdin, output: stdout })
try {
  const dir = path.join(root, 'backups')
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(isValidBackupName).sort().reverse() : []
  if (!files.length) throw new Error('No hay copias exportadas en backups/. Usá backup-datos.bat primero.')
  files.forEach((name, i) => console.log(`${i + 1}. ${name}`))
  const choice = await prompt.question('Número de copia (Enter cancela): ')
  if (choice.trim()) {
    const name = files[Number(choice) - 1]
    if (!name) throw new Error('Selección inválida.')
    const confirmation = await prompt.question(`Se reemplazarán los datos actuales con ${name}. Escribí RESTAURAR: `)
    if (confirmation === 'RESTAURAR') {
      docker(['compose', 'cp', `./backups/${name}`, `backend:/tmp/${name}`])
      const existing = backend('list')
      if (!existing.some((entry) => entry.name === name)) backend('import', name)
      console.log(backend('restore', name, '--confirm'))
      console.log('Restauración completada. Se conservó un respaldo del estado previo.')
    }
  }
} catch (err) { console.error(err.message); process.exitCode = 1 } finally { prompt.close() }
