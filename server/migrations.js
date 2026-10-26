import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from './db.js'

const serverDir = path.dirname(fileURLToPath(import.meta.url))
const cli = path.join(serverDir, 'node_modules/prisma/build/index.js')
function migrate(...args) {
  return execFileSync(process.execPath, [cli, ...args], { cwd: serverDir, env: process.env, stdio: 'inherit', windowsHide: true })
}

export async function ensureSchema() {
  const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  const existing = tables.map((row) => row.tablename)
  if (existing.length && !existing.includes('_prisma_migrations')) {
    // Adopta la base antigua creada con db push solo si coincide exactamente.
    // --exit-code devuelve 2 cuando hay diferencias; en ese caso no se toca nada.
    migrate('migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/baseline.prisma', '--exit-code')
    migrate('migrate', 'resolve', '--applied', '20261019000000_initial')
  }
  migrate('migrate', 'deploy')
}
