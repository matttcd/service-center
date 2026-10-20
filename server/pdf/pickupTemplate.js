import { LOGO_DATA_URL } from './logo.js'

// ============================================
// pickupTemplate.js: HTML template for pickup receipt PDF via Puppeteer
// ============================================

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy}  ${hh}:${mi}`
}
function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 2,
  }).format(n || 0)
}

function titleCase(str) {
  if (!str) return ''
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function plainList(items) {
  if (!items || items.length === 0) return '<span style="color:#999">Sin datos</span>'
  return esc(items.join(', '))
}

function field(label, value) {
  return `<div class="field"><div class="lbl">${esc(label)}</div><div class="val">${value || '<span style="color:#999">&mdash;</span>'}</div></div>`
}

export function buildPickupHtml(order, customer, pickup) {
  const custName = customer?.fullName || order?.customerName || ''
  const dni = customer?.dni || ''
  const phones = [customer?.phone, customer?.phone2, customer?.phone3].filter(Boolean).join(' / ') || ''
  const address = customer?.address || ''
  const receivedByName = order?.receivedByName || ''
  const deviceType = order?.deviceType || 'Celular'
  const devName = `${deviceType} · ${titleCase(order?.brand || '')} ${titleCase(order?.model || '')}`.trim()
  const accessoryList = (order?.accessories || '').split(',').map((s) => s.trim()).filter(Boolean)
  const conditionList = (order?.conditions || '').split(',').map((s) => s.trim()).filter(Boolean)
  const fixList = (order?.fix || '').split(',').map((s) => s.trim()).filter(Boolean)
  const priceStr = order?.price > 0 ? formatMoney(order.price) : ''
  const advanceStr = order?.advance > 0 ? formatMoney(order.advance) : ''
  const isRevision = order?.diagnosisType === 'revision'

  const isThird = pickup?.pickupBy === 'third'
  const pickupName = isThird ? (pickup?.pickupName || '') : custName
  const pickupDni = isThird ? (pickup?.pickupDni || '') : dni

  const date = formatDateTime(new Date().toISOString())

  const pickupBullets = [
    'Para hacer valer la garantía, el cliente deberá presentar la <strong>orden original</strong> dentro de las <strong>cuarenta y ocho (48) horas</strong> desde la fecha de retiro.',
    'Sin la <strong>orden original</strong> no se reconocerá garantía alguna sobre las reparaciones realizadas.',
    'La garantía tiene una duración de <strong>treinta (30) días</strong> corridos desde el retiro y cubre exclusivamente las reparaciones detalladas en la presente constancia.',
    'Los pagos son exclusivamente <strong>en efectivo</strong>.',
    'Para cualquier duda o consulta comunicarse al <strong>3704-583266</strong> o al <strong>3704-676320</strong>.',
    'Declaro haber leído y acepto las condiciones precedentemente descriptas.',
  ]

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; }
  .page { width: 210mm; padding: 7mm 7mm 18mm 7mm; }

  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3mm; }
  .header-left h1 { font-size: 14pt; font-weight: 700; letter-spacing: -0.3px; }
  .header-left p { font-size: 9pt; color: #555; margin-top: 1px; }
  .header-left .header-contact { font-size: 8pt; color: #555; margin-top: 2px; line-height: 1.4; }
  .header-center { display: flex; align-items: center; justify-content: center; }
  .header-logo { width: 18mm; height: 18mm; border-radius: 50%; object-fit: contain; }
  .header-right { text-align: right; }
  .header-right .doc-title { font-size: 7pt; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 1.5px; }
  .header-right .order-num { font-size: 12pt; font-weight: 700; margin-top: 1px; }
  .header-right .order-date { font-size: 9pt; color: #555; margin-top: 2px; }

  h2 { font-size: 8pt; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 2mm; border-bottom: 0.5px solid #ddd; padding-bottom: 1mm; }

  .field { margin-bottom: 2.5mm; }
  .field .lbl { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5mm; }
  .field .val { font-size: 10.5pt; color: #111; }
  .field .val-price { font-weight: 700; font-size: 12pt; }

  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1mm 5mm; margin-bottom: 3mm; }

  .note { background: #f8f8f8; border: 1px solid #ddd; border-radius: 3mm; padding: 3mm 4mm; font-size: 9.5pt; color: #555; margin-bottom: 3mm; line-height: 1.4; }

  .legal-list { font-size: 10pt; line-height: 1.45; color: #222; margin-top: 2mm; padding-left: 5mm; }
  .legal-list li { margin-bottom: 1.5mm; }

  .signatures { position: fixed; bottom: 8mm; left: 7mm; right: 7mm; display: flex; flex-direction: column; align-items: center; gap: 4mm; }
  .sig-sello { border: 0.5px dashed #bbb; border-radius: 2mm; height: 20mm; width: 35mm; max-width: 35mm; margin-bottom: 2mm; display: flex; align-items: center; justify-content: center; }
  .sig-sello-text { font-size: 6.5pt; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-row { display: flex; gap: 3mm; width: 100%; }
  .sig-col { flex: 1; text-align: center; }
  .sig-col .sig-line { border-top: 0.5px solid #333; margin-top: 10mm; margin-bottom: 1.5mm; }
  .sig-col .sig-label { font-size: 7pt; color: #666; text-transform: uppercase; letter-spacing: 1px; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-left">
      <h1>El Gringo Celulares</h1>
      <div class="header-contact">
        Belgrano 698, Esquina España<br>
         WhatsApp: 3704-583266 | 3704-676320
      </div>
    </div>
    <div class="header-center">
      <img src="${LOGO_DATA_URL}" class="header-logo" />
    </div>
    <div class="header-right">
      <div class="doc-title">Constancia de Retiro</div>
      <div class="order-num">${esc(order?.orderNumber || '')}</div>
      <div class="order-date">${date}</div>
    </div>
  </div>

  <h2>Datos del cliente</h2>
  <div class="grid2">
    ${field('Nombre', esc(custName))}
    ${field('DNI', esc(dni))}
    ${field('Telefono', esc(phones))}
    ${field('Domicilio', esc(address))}
  </div>

  <h2>Equipo recibido</h2>
  <div class="grid2">
    ${field('Marca / Modelo', esc(devName))}
    ${field('Accesorios', plainList(accessoryList))}
    ${field('Estado', plainList(conditionList))}
    ${field('Recibido por', esc(receivedByName))}
  </div>

  <h2>Reparacion</h2>
  ${field('Tipo de reparación', isRevision ? 'Revisión' : 'Reparación', { full: true })}
  ${fixList.length > 0 ? field('Detalle', plainList(fixList), { full: true }) : ''}
  <div class="grid2">
    ${field('Presupuesto', `<span class="val-price">${esc(priceStr) || '&mdash;'}</span>`)}
    ${order?.advance > 0 ? field('Seña recibida', `<span class="val-price">${esc(advanceStr)}</span>`) : ''}
  </div>

  <h2>Retira el sr/sra</h2>
  <div class="grid2">
    ${field('Nombre completo', esc(pickupName))}
    ${field('DNI', esc(pickupDni))}
  </div>

  ${isThird ? `<div class="note">El equipo es retirado por una persona distinta al titular de la orden de servicio.</div>` : ''}

  <h2>Términos y condiciones</h2>
  <ol class="legal-list">
    ${pickupBullets.map((b) => `<li>${b}</li>`).join('\n    ')}
  </ol>

</div>

<div class="signatures">
  <div class="sig-sello"><span class="sig-sello-text">Sello</span></div>
  <div class="sig-row">
    <div class="sig-col">
      <div class="sig-line">&nbsp;</div>
      <div class="sig-label">Firma</div>
    </div>
    <div class="sig-col">
      <div class="sig-line">&nbsp;</div>
      <div class="sig-label">Aclaracion</div>
    </div>
    <div class="sig-col">
      <div class="sig-line">&nbsp;</div>
      <div class="sig-label">DNI</div>
    </div>
  </div>
</div>

</body>
</html>`
}
