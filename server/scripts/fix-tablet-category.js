// Re-categoriza modelos de "Celular" a "Tablet" basándose en patrones de nombre.
// Afecta: Galaxy Tab, iPad, Moto Tab, Pixel Tablet, TCL Tab, Cat Tablet, Blackview Tab, BGH Tab, Lenovo Tab, Huawei MatePad, etc.
import { prisma } from '../db.js'

const TABLET_PATTERNS = [
  /\bTab\b/i,
  /\biPad\b/i,
  /\bTablet\b/i,
  /\bMatePad\b/i,
  /\bTab\b.*\b\d/i,
  /\b\d+\.\d+[""]?\b.*\b(Samsung|Apple|Lenovo|Motorola|Huawei|Xiaomi|Honor)\b/i,
]

function isTabletName(name) {
  return TABLET_PATTERNS.some((re) => re.test(name))
}

async function main() {
  const celulares = await prisma.catalogModel.findMany({
    where: { deviceType: 'Celular' },
    select: { id: true, brand: true, name: true, deviceType: true },
  })

  const toUpdate = celulares.filter((m) => isTabletName(m.name))
  console.log(`Modelos a re-categorizar como Tablet: ${toUpdate.length}`)

  if (toUpdate.length === 0) {
    console.log('Nada que hacer.')
    await prisma.$disconnect()
    return
  }

  // Agrupar por marca para log
  const byBrand = {}
  toUpdate.forEach((m) => { byBrand[m.brand] = (byBrand[m.brand] || 0) + 1 })
  console.log('Por marca:', byBrand)

  // Actualizar cada modelo: necesitamos crear con el nuevo deviceType y borrar el viejo
  // porque @@unique([brand, name, deviceType]) lo permite directamente.
  for (const m of toUpdate) {
    await prisma.catalogModel.update({
      where: { id: m.id },
      data: { deviceType: 'Tablet' },
    })
  }

  console.log(`\n✅ ${toUpdate.length} modelos re-categorizados como Tablet.`)

  const after = await prisma.catalogModel.groupBy({ by: ['deviceType'], _count: { deviceType: true } })
  console.log('\nDistribución después:')
  after.sort((a, b) => b._count.deviceType - a._count.deviceType)
  after.forEach((p) => console.log(`  ${p.deviceType} -> ${p._count.deviceType}`))

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
