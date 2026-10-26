import { startServer } from './index.js'
import { backupKey } from './backup-crypto.js'
import { printTransport } from './printing.js'
import { ensureSchema } from './migrations.js'

backupKey(process.env.BACKUP_ENCRYPTION_KEY)
if (printTransport() === 'bridge' && !process.env.PRINT_BRIDGE_TOKEN) throw new Error('Falta PRINT_BRIDGE_TOKEN.')
await ensureSchema()
await startServer()
