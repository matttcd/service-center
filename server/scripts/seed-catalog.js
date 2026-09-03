import { CATALOG } from '../seed.js'

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000'
const EMAIL = process.env.EMAIL || 'admin@local.com'
const PASSWORD = process.env.PASSWORD || 'admin123'

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const data = await res.json()
  if (!res.ok || !data.token) {
    console.error('Login fallido:', data.error || res.status)
    process.exit(1)
  }
  return data.token
}

async function bulkImport(token, models) {
  const res = await fetch(`${BASE_URL}/api/catalog/models/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ models }),
  })
  return res.json()
}

async function main() {
  console.log(`\n=== Seed del catálogo ===`)
  console.log(`URL: ${BASE_URL}`)
  console.log(`Marcas en CATALOG: ${CATALOG.length}`)

  // Aplanar todos los modelos
  const allModels = []
  for (const entry of CATALOG) {
    const brand = entry.brand
    const deviceType = entry.deviceType || 'Celular'
    for (const name of entry.models) {
      if (name) allModels.push({ brand, name, deviceType })
    }
  }
  console.log(`Modelos totales: ${allModels.length}`)

  // Login
  console.log(`\nAutenticando como ${EMAIL}...`)
  const token = await login()
  console.log('OK')

  // Enviar en chunks de 500 (el endpoint acepta hasta 5000)
  const CHUNK = 500
  let totalCreated = 0
  let totalSkipped = 0
  const chunks = Math.ceil(allModels.length / CHUNK)

  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK
    const batch = allModels.slice(start, start + CHUNK)
    process.stdout.write(`[${i + 1}/${chunks}] Enviando ${batch.length} modelos... `)
    const result = await bulkImport(token, batch)
    if (result.ok) {
      totalCreated += result.created
      totalSkipped += result.skipped
      console.log(`+${result.created} creados, ${result.skipped} saltados (total: ${result.total})`)
    } else {
      console.log(`ERROR: ${result.error}`)
    }
  }

  console.log(`\n=== Resumen ===`)
  console.log(`Creados: ${totalCreated}`)
  console.log(`Ya existían: ${totalSkipped}`)
  console.log(`Total en catálogo: ${totalCreated + totalSkipped}`)
}

main().catch(console.error)
