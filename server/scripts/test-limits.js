// Test final de límites: verifica que issue 200 + terms 1600 + máx items
// quepan sin solapamiento, incluyendo el truncado con "...".
// IMPORTANTE: borrar este script después de la prueba.
import puppeteer from 'puppeteer'
import { existsSync, writeFileSync } from 'node:fs'
import { buildOrderHtml } from '../pdf/orderTemplate.js'

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync)
const A4_W_PX = Math.round((210 / 25.4) * 96)
const A4_H_PX = Math.round((297 / 25.4) * 96)
const mm = (px) => (px / 96) * 25.4

// ------------------------------------------------------------------
// Simula la función de truncado que se implementará en orderTemplate.js
// ------------------------------------------------------------------
function truncate(str, max) {
  str = String(str ?? '')
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '…'
}

function truncateList(items, maxItems) {
  if (!items || items.length === 0) return 'Sin datos'
  if (items.length > maxItems) {
    const shown = items.slice(0, maxItems)
    return `${shown.join(', ')}… y ${items.length - maxItems} más`
  }
  return items.join(', ')
}

const LIMITS = {
  issue: 200,
  terms: 1600,
  accessories: 10,
  conditions: 8,
  fixes: 8,
}

const customer = {
  fullName: 'Juan Pérez',
  dni: '30123456',
  phone: '3704-583266',
  phone2: '3704-123456',
  phone3: '3704-999999',
  address: 'Av. Libertador 1234, Piso 3, Formosa Capital',
}

const baseOrder = {
  orderNumber: 'OS1234',
  createdAt: '2026-09-03T15:00:00.000Z',
  deviceType: 'Celular',
  brand: 'Samsung',
  model: 'Galaxy S23',
  receivedByName: 'Lucho',
  diagnosisType: 'visible',
  pin: '1234',
  pattern: [0, 1, 2, 5, 8],
  price: 45000,
  advance: 10000,
}

function makeIssue(n) {
  const t = 'El equipo presenta daño por líquido. Se requiere revisión exhaustiva del circuito de carga y batería, y reemplazo del módulo display. '
  return t.repeat(Math.ceil(n / t.length)).slice(0, n)
}

function makeTerms(n) {
  const t = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore. '
  return [t.repeat(Math.ceil(n / t.length)).slice(0, n)]
}

// Términos REALES que están en orderTemplate.js (con <strong>)
const realTerms = [
  'Para la entrega del equipo, el cliente o un tercero asignado deberán presentar la <strong>orden</strong>. Si es un tercero, deberá contar con una <strong>autorización explícita</strong> del titular. Si el cliente no presenta la orden física, se podrá entregar el equipo con una constancia de retiro firmada (únicamente el cliente titular). Sin la <strong>orden original</strong> no se reconocerá garantía alguna.',
  'La garantía tiene una duración de <strong>treinta (30) días</strong> corridos desde el retiro y cubre exclusivamente las reparaciones detalladas en la presente orden.',
  'Transcurridos <strong>treinta (30) días</strong> desde la notificación de que el equipo está listo sin que haya sido retirado, El Gringo Celulares se reserva el derecho de modificar el presupuesto debido a variaciones en los costos de repuestos.',
  'Los pagos son exclusivamente <strong>en efectivo</strong>.',
  'Para cualquier duda o consulta sobre el estado de su dispositivo comunicarse al <strong>3704-583266</strong> o al <strong>3704-676320</strong>.',
  'Declaro haber leído y acepto las condiciones precedentemente descriptas.',
]

// ------------------------------------------------------------------
// CASOS
// ------------------------------------------------------------------
const tests = [
  {
    name: '1. Issue 200 (límite) + TÉRMINOS REALES',
    file: 'test-final-issue200-realTerms.pdf',
    order: { ...baseOrder, accessories: 'Funda, Cargador', conditions: 'Golpeado, Mojado', issue: makeIssue(200), fix: 'Cambio de batería' },
    terms: realTerms,
  },
  {
    name: '2. Issue LARGO (300) truncado a 200 + TÉRMINOS REALES',
    file: 'test-final-issue-truncated-realTerms.pdf',
    order: { ...baseOrder, accessories: 'Funda, Cargador', conditions: 'Golpeado, Mojado', issue: truncate(makeIssue(300), LIMITS.issue), fix: 'Cambio de batería' },
    terms: realTerms,
  },
  {
    name: '3. Accesorios 14 truncados a 10 + TÉRMINOS REALES',
    file: 'test-final-acc-truncated-realTerms.pdf',
    order: {
      ...baseOrder,
      accessories: truncateList('Cable USB, Funda, Cargador, Vidrio, SIM, SD, Auriculares, Soporte, Martillo, Taladro, Wincha, Cinta, Goma, Caja'.split(','), LIMITS.accessories),
      conditions: 'Normal',
      issue: makeIssue(200),
      fix: 'Cambio de batería',
    },
    terms: realTerms,
  },
  {
    name: '4. Condiciones 10 truncadas a 8 + TÉRMINOS REALES',
    file: 'test-final-cond-truncated-realTerms.pdf',
    order: {
      ...baseOrder,
      accessories: 'Funda',
      conditions: truncateList('Apagado, Mojado, Golpeado, Display Roto, No se pudo probar, Batería hinchada, Marco doblado, Puerto roto, Tapa rayada, Tornillo flojo'.split(','), LIMITS.conditions),
      issue: makeIssue(200),
      fix: 'Cambio de batería',
    },
    terms: realTerms,
  },
  {
    name: '5. TODO MÁXIMO + TÉRMINOS REALES',
    file: 'test-final-all-max-realTerms.pdf',
    order: {
      ...baseOrder,
      accessories: 'Cable USB, Funda, Cargador, Vidrio, SIM, SD, Auriculares, Soporte, Martillo, Taladro',
      conditions: 'Apagado, Mojado, Golpeado, Display Roto, No se pudo probar, Batería hinchada, Marco doblado, Puerto roto',
      issue: makeIssue(200),
      fix: 'Cambio de módulo, Pin de carga, Microfono, Batería, Pantalla, Frame, Botón power, Speaker',
    },
    terms: realTerms,
  },
  {
    name: '6. TODO MÁXIMO + TÉRMINOS REALES ×2 (repetidos para medir)',
    file: 'test-final-all-max-realTerms-x2.pdf',
    order: {
      ...baseOrder,
      accessories: 'Cable USB, Funda, Cargador, Vidrio, SIM, SD, Auriculares, Soporte, Martillo, Taladro',
      conditions: 'Apagado, Mojado, Golpeado, Display Roto, No se pudo probar, Batería hinchada, Marco doblado, Puerto roto',
      issue: makeIssue(200),
      fix: 'Cambio de módulo, Pin de carga, Microfono, Batería, Pantalla, Frame, Botón power, Speaker',
    },
    terms: realTerms.concat(realTerms),
  },
]

// ------------------------------------------------------------------
// EJECUCIÓN
// ------------------------------------------------------------------
const browser = await puppeteer.launch({ headless: true, executablePath: CHROME, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: A4_W_PX, height: A4_H_PX })

async function measurePositions() {
  return await page.evaluate(() => {
    const mm = (px) => (px / 96) * 25.4
    const signatures = document.querySelector('.signatures')
    const legalList = document.querySelector('.legal-list')
    const issueEl = Array.from(document.querySelectorAll('.lbl')).find((l) => l.textContent.includes('Chequeos'))
    return {
      sigTop: signatures ? mm(signatures.getBoundingClientRect().top) : null,
      legalBottom: legalList ? mm(legalList.getBoundingClientRect().bottom) : null,
      legalChars: legalList?.textContent?.length || null,
      issueText: issueEl?.nextElementSibling?.textContent || null,
    }
  })
}

console.log('='.repeat(60))
console.log('TEST FINAL DE LÍMITES (con truncado)')
console.log(`Límites: issue=${LIMITS.issue}, terms=${LIMITS.terms}, acc=${LIMITS.accessories}, cond=${LIMITS.conditions}, fix=${LIMITS.fixes}`)
console.log('='.repeat(60))

const results = []

for (const t of tests) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`CASO: ${t.name}`)
  console.log(`${'─'.repeat(60)}`)

  await page.setContent(buildOrderHtml(t.order, customer, t.terms), { waitUntil: 'load', timeout: 20000 })
  const pos = await measurePositions()
  const alerts = []

  if (pos.legalBottom && pos.sigTop) {
    const gap = pos.sigTop - pos.legalBottom
    if (gap < 0) alerts.push(`Términos overlap Firmas (${gap.toFixed(1)}mm)`)
    else if (gap < 5) alerts.push(`Gap mínimo Términos→Firmas: ${gap.toFixed(1)}mm`)
    else console.log(`  Términos→Firmas: gap=${gap.toFixed(1)}mm OK`)
  }

  // Verificar que el issue esté truncado con "..."
  if (pos.issueText) {
    console.log(`  Issue en PDF (${pos.issueText.length} chars): "${pos.issueText.slice(0, 30)}${pos.issueText.length > 30 ? '…' : ''}"`)
    if (pos.issueText.length > LIMITS.issue + 1) alerts.push(`Issue no truncado: ${pos.issueText.length} chars > ${LIMITS.issue}`)
    else console.log(`  Issue truncado OK (≤ ${LIMITS.issue + 1} chars)`)
  }

  console.log(`  Términos chars: ${pos.legalChars}`)

  const status = alerts.length === 0 ? '✅ OK' : `🚨 ${alerts.length} alerta(s)`
  alerts.forEach((a) => console.log(`  🚨 ${a}`))
  console.log(`  => ${status}`)

  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, pageRanges: '1' })
  writeFileSync(t.file, pdf)
  console.log(`  PDF: ${t.file}`)

  results.push({ name: t.name, file: t.file, status: alerts.length === 0 ? 'OK' : 'ALERTA' })
}

console.log(`\n${'='.repeat(60)}`)
console.log('RESUMEN FINAL')
console.log('='.repeat(60))
results.forEach((r) => console.log(`${r.status === 'OK' ? '✅' : '🚨'} ${r.name} (${r.file})`))

await browser.close()
console.log('\nPrueba completada.')
