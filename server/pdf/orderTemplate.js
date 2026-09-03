import { LOGO_DATA_URL } from './logo.js'

const DOTS = [
  [25, 25], [75, 25], [125, 25],
  [25, 75], [75, 75], [125, 75],
  [25, 125], [75, 125], [125, 125],
]

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

function patternSvg(pattern) {
  const pts = (pattern || []).slice(0, 9).filter((n) => Number.isInteger(n) && n >= 0 && n < 9)
  let svg = ''
  for (let i = 1; i < pts.length; i++) {
    const a = DOTS[pts[i - 1]], b = DOTS[pts[i]]
    svg += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#333" stroke-width="2.5" stroke-linecap="round"/>`
  }
  DOTS.forEach(([cx, cy], i) => {
    const active = pts.indexOf(i) >= 0
    svg += `<circle cx="${cx}" cy="${cy}" r="7" fill="${active ? '#222' : '#fff'}" stroke="#444" stroke-width="1.2"/>`
    if (active) {
      svg += `<text x="${cx}" y="${cy + 2.5}" text-anchor="middle" font-size="9" font-family="Arial,sans-serif" font-weight="bold" fill="#fff">${pts.indexOf(i) + 1}</text>`
    }
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" width="110" height="110">${svg}</svg>`
}

function field(label, value, opts = {}) {
  const cls = opts.cls || ''
  const full = opts.full ? ' grid2-full' : ''
  return `<div class="field${full}"><div class="lbl">${esc(label)}</div><div class="val ${cls}">${value || '<span style="color:#999">&mdash;</span>'}</div></div>`
}

export function buildOrderHtml(order, customer) {
  const custName = customer?.fullName || order?.customerName || ''
  const dni = customer?.dni || ''
  const phones = [customer?.phone, customer?.phone2, customer?.phone3].filter(Boolean).join(' / ') || '—'
  const address = customer?.address || ''
  const receivedByName = order?.receivedByName || ''
  const deviceType = order?.deviceType || 'Celular'
  const devName = `${deviceType} · ${titleCase(order?.brand || '')} ${titleCase(order?.model || '')}`.trim()
  const pin = order?.pin || ''
  const accessoryList = (order?.accessories || '').split(',').map((s) => s.trim()).filter(Boolean)
  const conditionList = (order?.conditions || '').split(',').map((s) => s.trim()).filter(Boolean)
  const issue = order?.issue || ''
  const fixList = (order?.fix || '').split(',').map((s) => s.trim()).filter(Boolean)
  const priceStr = order?.price > 0 ? formatMoney(order.price) : ''
  const advanceStr = order?.advance > 0 ? formatMoney(order.advance) : ''
  const isRevision = order?.diagnosisType === 'revision'
  const hasFixData = fixList.length > 0 || order?.price > 0

  const contractBullets = [
    'Para la entrega del equipo, el cliente o un tercero asignado deberán presentar la <strong>orden</strong>. Si es un tercero, deberá contar con una <strong>autorización explícita</strong> del titular. Si el cliente no presenta la orden física, se podrá entregar el equipo con una constancia de retiro firmada (únicamente el cliente titular). Sin la <strong>orden original</strong> no se reconocerá garantía alguna.',
    'La garantía tiene una duración de <strong>treinta (30) días</strong> corridos desde el retiro y cubre exclusivamente las reparaciones detalladas en la presente orden.',
    'Transcurridos <strong>treinta (30) días</strong> desde la notificación de que el equipo está listo sin que haya sido retirado, El Gringo Celulares se reserva el derecho de modificar el presupuesto debido a variaciones en los costos de repuestos.',
    'Los pagos son exclusivamente <strong>en efectivo</strong>.',
    'Para cualquier duda o consulta sobre el estado de su dispositivo comunicarse al <strong>3704-583266</strong> o al <strong>3704-676320</strong>.',
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

  hr.simple { border: none; border-top: 1px solid #333; margin-bottom: 3mm; }

  h2 { font-size: 8pt; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 2mm; border-bottom: 0.5px solid #ddd; padding-bottom: 1mm; display: flex; align-items: baseline; gap: 3mm; }
  h2 .h2-date { margin-left: auto; font-weight: 400; letter-spacing: 0; font-size: 8pt; color: #555; white-space: nowrap; }
  h2 .h2-date-line { display: inline-block; width: 25mm; border-bottom: 0.5px solid #999; margin: 0 1mm; }

  .field { margin-bottom: 2.5mm; }
  .field .lbl { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5mm; }
  .field .val { font-size: 10.5pt; color: #111; }
  .field .val-price { font-weight: 700; font-size: 12pt; }

  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1mm 5mm; margin-bottom: 3mm; }
  .grid2-full { grid-column: 1 / -1; }

  .equip-grid { display: flex; gap: 5mm; margin-bottom: 3mm; }
  .equip-col { flex: 1; }

  .legal-list { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #222; margin-top: 3mm; padding-left: 5mm; }
  .legal-list li { margin-bottom: 2mm; }

  .signatures { position: fixed; bottom: 8mm; left: 7mm; right: 7mm; display: flex; gap: 0; }
  .sig-sep { width: 0.5px; background: #ccc; margin: 0 3mm; }
  .sig-block { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; }
  .sig-block-title { font-size: 8pt; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin-bottom: 3mm; }
  .sig-sello { border: 0.5px dashed #bbb; border-radius: 2mm; height: 20mm; width: 35mm; max-width: 35mm; margin: 0 auto 3mm auto; display: flex; align-items: center; justify-content: center; }
  .sig-sello-text { font-size: 6.5pt; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-row { display: flex; gap: 3mm; }
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
      <div class="doc-title">Orden de Servicio</div>
      <div class="order-num">${esc(order?.orderNumber || '')}</div>
      <div class="order-date">${formatDateTime(order?.createdAt)}</div>
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
  <div class="equip-grid">
    <div class="equip-col">
      ${field('Marca / Modelo', esc(devName))}
      ${field('Accesorios', plainList(accessoryList))}
      ${field('Estado', plainList(conditionList))}
      ${field('Chequeos / notas generales', esc(issue) || '<span style="color:#999">&mdash;</span>')}
    </div>
    <div class="equip-col">
      ${field('Recibido por', esc(receivedByName))}
      ${field('PIN / contrasena', esc(pin))}
      <div class="field">
        <div class="lbl">Patron de desbloqueo</div>
        ${order?.pattern?.length > 0 ? patternSvg(order.pattern) : '<div style="font-size:10pt;color:#999">Sin patron</div>'}
      </div>
    </div>
  </div>

  <h2>Reparacion</h2>
  ${field('Tipo de reparación', isRevision ? 'Revisión' : plainList(fixList), { full: true })}
  <div class="grid2">
    ${field('Presupuesto', `<span class="val-price">${esc(priceStr) || '&mdash;'}</span>`)}
    ${order?.advance > 0 ? field('Sena recibida', `<span class="val-price">${esc(advanceStr)}</span>`) : ''}
  </div>

  <h2>Terminos y condiciones</h2>
  <ol class="legal-list">
    ${contractBullets.map((b) => `<li>${b}</li>`).join('\n    ')}
  </ol>

</div>

<div class="signatures">
  <div class="sig-block">
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
  <div class="sig-sep"></div>
  <div class="sig-block">
    <div class="sig-block-title">Se retira en la fecha: ___/___/______</div>
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
  </div>
</div>

</body>
</html>`
}
