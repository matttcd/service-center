// Script temporal de medición: genera PDFs de prueba con contenido extremo
// y verifica que ninguna sección se sobreponga con otra ni con las firmas.
import puppeteer from 'puppeteer'
import { existsSync, writeFileSync } from 'node:fs'
import { buildOrderHtml } from '../pdf/orderTemplate.js'

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync)

const A4_W_PX = Math.round((210 / 25.4) * 96)
const A4_H_PX = Math.round((297 / 25.4) * 96)

const customer = {
  fullName: 'Juan Pérez',
  dni: '30123456',
  phone: '3704-583266',
  phone2: '3704-123456',
  phone3: '3704-999999',
  address: 'Av. Libertador 1234, Piso 3, Depto B, Formosa Capital',
}

const baseOrder = {
  orderNumber: 'OS1234',
  createdAt: '2026-09-03T15:00:00.000Z',
  deviceType: 'Celular',
  brand: 'Samsung',
  model: 'Galaxy S23 Ultra',
  receivedByName: 'Lucho',
  diagnosisType: 'visible',
  pin: '1234',
  pattern: [0, 1, 2, 5, 8],
}

const cases = [
  {
    name: 'Muchos accesorios',
    file: 'test-case-1.pdf',
    order: {
      ...baseOrder,
      accessories: 'Cable USB-C, Funda silicona, Cargador original, Vidrio templado, Tarjeta SIM, SD 64gb, Auriculares Bluetooth, Soporte magnético, Martillo, Taladro, Wincha, Cinta adhesiva',
      conditions: 'Apagado, Mojado, Golpeado, Display Roto, No se pudo probar',
      issue: 'Equipo no enciende.',
      fix: 'Cambio de módulo',
      price: 45000,
      advance: 10000,
    },
  },
  {
    name: 'Notas largas',
    file: 'test-case-2.pdf',
    order: {
      ...baseOrder,
      accessories: 'Funda, Cargador, Vidrio',
      conditions: 'Golpeado, Mojado',
      issue: 'El cliente relata que el equipo se cayó al piso desde aproximadamente 1.5 metros de altura sobre superficie de cerámica. El dispositivo presenta una grieta visible en la esquina superior derecha del panel frontal y el display muestra manchas oscuras en la zona del LED. Además, el puerto de carga USB-C presenta oxidación visible y el cable original no logra establecer conexión estable. La batería se descarga inusualmente rápido (aproximadamente 20% por hora en standby). El botón de encendido responde intermitentemente y el altavoz principal emite sonido distorsionado al volumen máximo. Se requiere revisión exhaustiva del circuito de carga, reemplazo de módulo display, limpieza del puerto USB-C y diagnóstico completo de placa madre.',
      fix: 'Cambio de módulo',
      price: 85000,
      advance: 20000,
    },
  },
  {
    name: 'Reparación densa',
    file: 'test-case-3.pdf',
    order: {
      ...baseOrder,
      accessories: 'Funda, Cargador',
      conditions: 'Golpeado, Display Roto',
      issue: 'Múltiples daños.',
      fix: 'Cambio de módulo, Pin de carga, Microfono, Bateria, Pantalla, Frame, Botón power, Speaker',
      price: 150000,
      advance: 50000,
    },
  },
  {
    name: 'Términos al límite',
    file: 'test-case-4.pdf',
    order: {
      ...baseOrder,
      accessories: 'Funda, Cargador',
      conditions: 'Normal',
      issue: 'Cambio de batería.',
      fix: 'Cambio de batería',
      price: 25000,
      advance: 0,
    },
    terms: true,
  },
  {
    name: 'Todo al máximo',
    file: 'test-case-5.pdf',
    order: {
      ...baseOrder,
      accessories: 'Cable USB-C, Funda silicona, Cargador original, Vidrio templado, Tarjeta SIM, SD 64gb, Auriculares Bluetooth, Soporte magnético, Martillo, Taladro, Wincha, Cinta adhesiva',
      conditions: 'Apagado, Mojado, Golpeado, Display Roto, No se pudo probar, Bateria hinchada, Marco doblado',
      issue: 'El cliente relata que el equipo se cayó al piso desde aproximadamente 1.5 metros de altura sobre superficie de cerámica. El dispositivo presenta una grieta visible en la esquina superior derecha del panel frontal y el display muestra manchas oscuras en la zona del LED. Además, el puerto de carga USB-C presenta oxidación visible y el cable original no logra establecer conexión estable. La batería se descarga inusualmente rápido. Se requiere revisión exhaustiva del circuito de carga, reemplazo de módulo display, limpieza del puerto USB-C y diagnóstico completo de placa madre.',
      fix: 'Cambio de módulo, Pin de carga, Microfono, Bateria, Pantalla, Frame, Botón power, Speaker',
      price: 150000,
      advance: 50000,
    },
    terms: true,
  },
]

const longTerms = [
  'Para la entrega del equipo, el cliente o un tercero asignado deberán presentar la <strong>orden</strong>. Si es un tercero, deberá contar con una <strong>autorización explícita</strong> del titular. Si el cliente no presenta la orden física, se podrá entregar el equipo con una constancia de retiro firmada (únicamente el cliente titular). Sin la <strong>orden original</strong> no se reconocerá garantía alguna.',
  'La garantía tiene una duración de <strong>treinta (30) días</strong> corridos desde el retiro y cubre exclusivamente las reparaciones detalladas en la presente orden. La garantía no cubre daños posteriores al retiro, ni defectos derivados del uso indebido del dispositivo por parte del cliente.',
  'Transcurridos <strong>treinta (30) días</strong> desde la notificación de que el equipo está listo sin que haya sido retirado, El Gringo Celulares se reserva el derecho de modificar el presupuesto debido a variaciones en los costos de repuestos. Asimismo, se reserva el derecho de disponer del equipo no retirado según la normativa vigente.',
  'Los pagos son exclusivamente <strong>en efectivo</strong>. No se aceptan transferencias bancarias, tarjetas de débito, tarjetas de crédito, ni ningún otro medio de pago. El comprobante de pago deberá ser conservado por el cliente para eventuales reclamos.',
  'Para cualquier duda o consulta sobre el estado de su dispositivo comunicarse al <strong>3704-583266</strong> o al <strong>3704-676320</strong>. Los horarios de atención al público son de lunes a viernes de 9:00 a 18:00 horas y sábados de 9:00 a 13:00 horas.',
  'Declaro haber leído y acepto las condiciones precedentemente descriptas. Declaro asimismo que el dispositivo fue entregado en las condiciones detalladas en la presente orden de servicio, y que me inhibo de realizar cualquier reclamo posterior por daños no contemplados.',
]

const browser = await puppeteer.launch({ headless: true, executablePath: CHROME, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: A4_W_PX, height: A4_H_PX })

const mm = (px) => (px / 96) * 25.4

async function measureAll() {
  return await page.evaluate(() => {
    const mm = (px) => (px / 96) * 25.4
    const sections = document.querySelectorAll('h2')
    const equipGrid = document.querySelector('.equip-grid')
    const legalList = document.querySelector('.legal-list')
    const signatures = document.querySelector('.signatures')

    const sectionData = Array.from(sections).map((s, i) => {
      const rect = s.getBoundingClientRect()
      const next = sections[i + 1]
      return {
        label: s.textContent.trim().split('\n')[0].trim(),
        topMm: mm(rect.top),
        bottomMm: mm(rect.bottom),
        nextTopMm: next ? mm(next.getBoundingClientRect().top) : null,
      }
    })

    let equipData = null
    if (equipGrid) {
      const gridRect = equipGrid.getBoundingClientRect()
      const cols = equipGrid.querySelectorAll('.equip-col')
      equipData = {
        topMm: mm(gridRect.top),
        bottomMm: mm(gridRect.bottom),
        heightMm: mm(gridRect.height),
        colBottoms: Array.from(cols).map((c) => mm(c.getBoundingClientRect().bottom)),
      }
    }

    let legalData = null
    if (legalList) {
      const rect = legalList.getBoundingClientRect()
      legalData = { topMm: mm(rect.top), bottomMm: mm(rect.bottom), heightMm: mm(rect.height), charCount: legalList.textContent.length }
    }

    let sigData = null
    if (signatures) {
      const rect = signatures.getBoundingClientRect()
      sigData = { topMm: mm(rect.top), bottomMm: mm(rect.bottom), heightMm: mm(rect.height) }
    }

    return { sectionData, equipData, legalData, sigData }
  })
}

function checkOverlaps(data) {
  const alerts = []
  const warnings = []

  if (data.equipData) {
    const gridBottom = data.equipData.bottomMm
    data.equipData.colBottoms.forEach((colBottom, i) => {
      if (colBottom > gridBottom + 0.5) alerts.push(`Columna ${i + 1} excede equip-grid`)
    })
    const reparacion = data.sectionData.find((s) => s.label.includes('Reparaci'))
    if (reparacion) {
      const gap = reparacion.topMm - gridBottom
      if (gap < 0) alerts.push(`Equip-grid overlap con Reparación (${gap.toFixed(1)}mm)`)
      else if (gap < 3) warnings.push(`Gap mínimo Equip-grid → Reparación: ${gap.toFixed(1)}mm`)
    }
  }

  for (let i = 0; i < data.sectionData.length - 1; i++) {
    const curr = data.sectionData[i]
    const next = data.sectionData[i + 1]
    let currBottom = curr.bottomMm
    if (curr.label.includes('Equipo') && data.equipData) currBottom = Math.max(...data.equipData.colBottoms)
    if (curr.label.includes('Terminos') && data.legalData) currBottom = data.legalData.bottomMm
    const gap = next.topMm - currBottom
    if (gap < 0) alerts.push(`"${curr.label}" overlap con "${next.label}" (${gap.toFixed(1)}mm)`)
    else if (gap < 3) warnings.push(`Gap mínimo "${curr.label}" → "${next.label}": ${gap.toFixed(1)}mm`)
  }

  if (data.legalData && data.sigData) {
    const gap = data.sigData.topMm - data.legalData.bottomMm
    if (gap < 0) alerts.push(`Términos overlap Firmas (${gap.toFixed(1)}mm)`)
    else if (gap < 5) warnings.push(`Gap mínimo Términos → Firmas: ${gap.toFixed(1)}mm`)
  }

  return { alerts, warnings }
}

console.log('='.repeat(60))
console.log('PRUEBA DE SOBREPOSICIÓN DE CAMPOS DEL PDF')
console.log('='.repeat(60))

for (const c of cases) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`CASO: ${c.name}`)
  console.log(`${'─'.repeat(60)}`)

  await page.setContent(buildOrderHtml({ ...c.order }, customer, c.terms ? longTerms : undefined), { waitUntil: 'load', timeout: 20000 })
  const data = await measureAll()
  const { alerts, warnings } = checkOverlaps(data)

  console.log('\nSecciones:')
  data.sectionData.forEach((s) => console.log(`  ${s.label}: top=${s.topMm.toFixed(1)}mm bottom=${s.bottomMm.toFixed(1)}mm`))

  if (data.equipData) {
    console.log(`\nEquip-grid: top=${data.equipData.topMm.toFixed(1)}mm bottom=${data.equipData.bottomMm.toFixed(1)}mm height=${data.equipData.heightMm.toFixed(1)}mm`)
    data.equipData.colBottoms.forEach((b, i) => console.log(`  Col ${i + 1} bottom: ${b.toFixed(1)}mm`))
  }

  if (data.legalData) console.log(`\nTérminos: top=${data.legalData.topMm.toFixed(1)}mm bottom=${data.legalData.bottomMm.toFixed(1)}mm chars=${data.legalData.charCount}`)
  if (data.sigData) console.log(`\nFirmas: top=${data.sigData.topMm.toFixed(1)}mm bottom=${data.sigData.bottomMm.toFixed(1)}mm height=${data.sigData.heightMm.toFixed(1)}mm`)

  if (alerts.length === 0 && warnings.length === 0) console.log('\n✅ OK — Sin solapamiento')
  else { alerts.forEach((a) => console.log(`\n🚨 ALERTA: ${a}`)); warnings.forEach((w) => console.log(`\n⚠️  WARNING: ${w}`)) }

  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, pageRanges: '1' })
  writeFileSync(c.file, pdf)
  console.log(`\nPDF: ${c.file}`)
}

console.log(`\n${'='.repeat(60)}`)
console.log('RESUMEN')
console.log('='.repeat(60))
for (const c of cases) {
  await page.setContent(buildOrderHtml({ ...c.order }, customer, c.terms ? longTerms : undefined), { waitUntil: 'load', timeout: 20000 })
  const data = await measureAll()
  const { alerts } = checkOverlaps(data)
  console.log(`${alerts.length === 0 ? '✅' : `🚨 ${alerts.length} alerta(s)`} ${c.name} (${c.file})`)
}

await browser.close()
console.log('\nPrueba completada.')
