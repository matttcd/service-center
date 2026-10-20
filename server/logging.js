// Los errores de Prisma pueden contener PIN, datos personales o hashes.
export function logError(context, error) {
  console.error(context, { name: error?.name || 'Error', code: error?.code || null })
}
