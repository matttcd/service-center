// Puebla el catálogo con las marcas y modelos de todos los tipos de dispositivo
// que faltan en la DB (tomados del CATALOG de seed.js). No borra ni duplica nada.
import { prisma } from '../db.js'
import { CATALOG } from '../seed.js'

async function main() {
  const existingModels = await prisma.catalogModel.findMany({
    select: { brand: true, name: true, deviceType: true },
  })
  const existingSet = new Set(
    existingModels.map((m) => `${m.brand.toLowerCase()}::${m.name.toLowerCase()}::${m.deviceType}`),
  )
  const existingBrands = new Set(
    (await prisma.catalogBrand.findMany({ select: { name: true } })).map((b) => b.name.toLowerCase()),
  )

  const brandsToAdd = []
  const seenBrands = new Set()
  const modelsToAdd = []
  const seenModels = new Set()

  for (const entry of CATALOG) {
    const deviceType = entry.deviceType || 'Celular'

    if (!existingBrands.has(entry.brand.toLowerCase()) && !seenBrands.has(entry.brand.toLowerCase())) {
      seenBrands.add(entry.brand.toLowerCase())
      brandsToAdd.push({ name: entry.brand })
    }

    for (const name of entry.models) {
      if (!name) continue
      const key = `${entry.brand.toLowerCase()}::${name.toLowerCase()}::${deviceType}`
      if (existingSet.has(key) || seenModels.has(key)) continue
      seenModels.add(key)
      modelsToAdd.push({ brand: entry.brand, name, deviceType, usage: 0 })
    }
  }

  let brandsCreated = 0
  if (brandsToAdd.length) {
    const res = await prisma.catalogBrand.createMany({ data: brandsToAdd, skipDuplicates: true })
    brandsCreated = res.count
  }

  let modelsCreated = 0
  if (modelsToAdd.length) {
    const res = await prisma.catalogModel.createMany({ data: modelsToAdd, skipDuplicates: true })
    modelsCreated = res.count
  }

  console.log(`\nMarcas nuevas: ${brandsCreated}`)
  console.log(`Modelos nuevos: ${modelsCreated}`)

  const byType = {}
  for (const m of modelsToAdd) byType[m.deviceType] = (byType[m.deviceType] || 0) + 1
  console.log('Modelos agregados por tipo:', byType)

  console.log(`Total marcas en DB: ${await prisma.catalogBrand.count()}`)
  console.log(`Total modelos en DB: ${await prisma.catalogModel.count()}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error en migración de catálogo:', e)
  process.exit(1)
})
