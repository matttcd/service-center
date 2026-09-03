// Script temporal de medición: genera un PDF de prueba con una orden realista
// y mide la posición vertical real de "Términos y condiciones" vs "Firmas"
// para calcular el espacio máximo disponible en caracteres.
import puppeteer from 'puppeteer'
import { existsSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { buildOrderHtml } from '../pdf/orderTemplate.js'

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync)

// Viewport A4 a 96dpi: 210mm x 297mm => 793.7 x 1122.5 px
const A4_W_PX = Math.round((210 / 25.4) * 96)
const A4_H_PX = Math.round((297 / 25.4) * 96)

// Orden de ejemplo con contenido realista (varias accesorios/condiciones).
const order = {
  orderNumber: 'OS1234',
  createdAt: '2026-09-03T15:00:00.000Z',
  deviceType: 'Celular',
  brand: 'Samsung',
  model: 'Galaxy S23',
  accessories: 'Funda, Cargador, Vidrio templado, SIM, SD, Auriculares',
  conditions: 'Apagado, Mojado, Golpeado, Display Roto, No se pudo probar funciones básicas',
  issue: 'El equipo no enciende y presenta daño por líquido. Se debe revision exhaustiva del circuito de carga y bateria.',
  pin: '1234',
  noPin: true,
  pattern: [0, 1, 2, 5, 8],
  fix: 'Cambio de módulo, Pin de carga, Microfono',
  price: 45000,
  advance: 10000,
  diagnosisType: 'visible',
  receivedByName: 'Lucho',
}
const customer = {
  fullName: 'Juan Pérez',
  dni: '30123456',
  phone: '3704-583266',
  address: 'Av. Libertador 1234, Formosa',
}

const contractBullets = [
  'Para la entrega del equipo, el cliente o un tercero asignado deberán presentar la orden. Si es un tercero, deberá contar con una autorización explícita del titular.',
  'La garantía tiene una duración de treinta (30) días corridos desde el retiro y cubre exclusivamente las reparaciones detalladas en la presente orden.',
  'Transcurridos treinta (30) días desde la notificación de que el equipo está listo sin que haya sido retirado, se reserva el derecho de modificar el presupuesto.',
  'Los pagos son exclusivamente en efectivo.',
  'Para cualquier duda o consulta sobre el estado de su dispositivo comunicarse a los teléfonos de contacto del local.',
  'Declaro haber leído y acepto las condiciones precedentemente descriptas.',
]

const browser = await puppeteer.launch({ headless: true, executablePath: CHROME, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: A4_W_PX, height: A4_H_PX })
await page.setContent(buildOrderHtml(order, customer), { waitUntil: 'load', timeout: 20000 })

// Mide las posiciones verticales reales (mm) en contexto de impresión A4.
const m = await page.evaluate(() => {
  const mm = (px) => (px / 96) * 25.4
  const t = document.querySelector('.legal-list')
  const s = document.querySelector('.signatures')
  return {
    viewportHmm: mm(window.innerHeight),
    termsTopMm: t ? mm(t.getBoundingClientRect().top) : null,
    termsHeightMm: t ? mm(t.getBoundingClientRect().height) : null,
    termsBottomMm: t ? mm(t.getBoundingClientRect().bottom) : null,
    signaturesTopMm: s ? mm(s.getBoundingClientRect().top) : null,
    signaturesBottomMm: s ? mm(s.getBoundingClientRect().bottom) : null,
    gapMm: t && s ? mm(s.getBoundingClientRect().top - t.getBoundingClientRect().bottom) : null,
  }
})
console.log('MEDICION (with current bullets):')
console.log(JSON.stringify(m, null, 2))

const currentChars = contractBullets.join('').length
const lineHeightMm = (10.5 * 1.45 / 72) * 25.4
const charsPerLine = 100
const extraLines = Math.floor((m.gapMm || 0) / lineHeightMm)
const extraChars = extraLines * charsPerLine
const maxTotalChars = currentChars + extraChars
console.log(`\nCaracteres actuales: ${currentChars}`)
console.log(`Lineas extras posibles: ${extraLines} (~${charsPerLine} chars/linea)`)
console.log(`Caracteres extras: ${extraChars}`)
console.log(`=> Limite estimado (bullets): ~${maxTotalChars} caracteres`)

// ---- Busca el limite REAL iterativamente (sube chars hasta justo antes de solapar) ----
const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. '
const loremClean = lorem.replace('Lorem ipsum dolor sit amet, consectetur adipiscing elit. ', '')

async function measureOverlap(bullets) {
  await page.setContent(buildOrderHtml(order, customer, bullets), { waitUntil: 'load', timeout: 20000 })
  return await page.evaluate(() => {
    const mm = (px) => (px / 96) * 25.4
    const t = document.querySelector('.legal-list')
    const s = document.querySelector('.signatures')
    if (!t || !s) return null
    return mm(t.getBoundingClientRect().bottom - s.getBoundingClientRect().top)
  })
}

let lo = 0, hi = 5000
// hi inicial: encontrar un valor que NO solape (overlap <= 0)
while (hi - lo > 50) {
  const mid = Math.floor((lo + hi) / 2)
  const overlap = await measureOverlap([loremClean.repeat(Math.ceil(mid / loremClean.length)).slice(0, mid)])
  if (overlap <= 0) { lo = mid } else { hi = mid }
}
const maxReal = lo
console.log(`\n=> LIMITE REAL (con lorem, un solo bloque): ~${maxReal} caracteres (overlap justo<0)`)
console.log(`=> LIMITE SEGURO recomendado: ~${Math.floor(maxReal * 0.9)} caracteres`)

// ---- Genera PDF de prueba justo al limite real ----
const testBullets = [loremClean.repeat(Math.ceil(maxReal / loremClean.length)).slice(0, maxReal)]
await measureOverlap(testBullets)
const pdf = await page.pdf({
  preferCSSPageSize: true,
  printBackground: true,
  pageRanges: '1',
})
writeFileSync('test-pdf-max.pdf', pdf)
console.log('PDF de prueba guardado en test-pdf-max.pdf')

const m2 = await measureOverlap(testBullets)
console.log('\nOverlap en el PDF generado:', m2, 'mm (negativo = sin solapamiento)')

await browser.close()
