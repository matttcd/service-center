// ============================================
// orderTemplate.js: HTML template for PDF via Puppeteer
// Field-block layout, plain text lists, contract-style B/W.
// ============================================

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
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
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
  const devName = `${titleCase(order?.brand || '')} ${titleCase(order?.model || '')}`.trim()
  const pin = order?.pin || ''
  const accessoryList = (order?.accessories || '').split(',').map((s) => s.trim()).filter(Boolean)
  const conditionList = (order?.conditions || '').split(',').map((s) => s.trim()).filter(Boolean)
  const issue = order?.issue || ''
  const fixList = (order?.fix || '').split(',').map((s) => s.trim()).filter(Boolean)
  const priceStr = order?.price > 0 ? formatMoney(order.price) : ''
  const advanceStr = order?.advance > 0 ? formatMoney(order.advance) : ''

  const contractBullets = [
    'El cliente declara conocer y prestar conformidad para que El Gringo Celulares realice las reparaciones del equipo detallado en la presente orden. Se avisa por telefono cuando el arreglo esta listo para retirar.',
    'El Gringo Celulares, bajo ningun punto de vista, se hace responsable por las perdidas de datos y/o informacion que pudieran existir en el equipo, sean fotos, contactos, agendas o cualquier otra clase de informacion almacenada en el mismo.',
    'El titular reconoce y acepta expresamente que el equipo es de su propiedad. Transcurridos treinta (30) dias desde la fecha de ingreso, el mismo debe ser retirado por el propietario. Transcurrido dicho plazo, la casa se reserva el uso y disposicion sin que por ello el cliente tenga derecho a reclamo alguno.',
    'El Gringo Celulares se hara responsable unicamente de la reparacion efectuada o del repuesto cambiado. El precio no incluye IVA (21.1%). Los pagos son unicamente en efectivo.',
    'Aceptacion del cliente: Declaro haber leido y acepto las condiciones precedentemente descriptas.',
  ]

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; }
  .page { width: 190mm; padding: 14mm 14mm 28mm 14mm; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3mm; }
  .header-left h1 { font-size: 14pt; font-weight: 700; letter-spacing: -0.3px; }
  .header-left p { font-size: 9pt; color: #555; margin-top: 1px; }
  .header-right { text-align: right; }
  .header-right .doc-title { font-size: 9pt; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 1.5px; }
  .header-right .order-num { font-size: 16pt; font-weight: 700; margin-top: 1px; }
  .header-right .order-date { font-size: 9pt; color: #555; margin-top: 2px; }

  hr.simple { border: none; border-top: 1px solid #333; margin-bottom: 3mm; }

  h2 { font-size: 8pt; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 2mm; border-bottom: 0.5px solid #ddd; padding-bottom: 1mm; }

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

  .signatures { position: fixed; bottom: 14mm; left: 14mm; right: 14mm; display: flex; gap: 4mm; }
  .sig-col { flex: 1; text-align: center; }
  .sig-col .sig-line { border-top: 0.5px solid #333; margin-bottom: 1mm; }
  .sig-col .sig-label { font-size: 7pt; color: #666; text-transform: uppercase; letter-spacing: 1px; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-left">
      <h1>El Gringo Celulares</h1>
      <p>Servicio Tecnico</p>
    </div>
    <div class="header-right">
      <div class="doc-title">Orden de Servicio</div>
      <div class="order-num">${esc(order?.orderNumber || '')}</div>
      <div class="order-date">${formatDateTime(order?.createdAt)}</div>
    </div>
  </div>
  <hr class="simple">

  <h2>1. Datos del cliente</h2>
  <div class="grid2">
    ${field('Nombre', esc(custName))}
    ${field('DNI', esc(dni))}
    ${field('Telefono', esc(phones))}
    ${field('Domicilio', esc(address))}
    ${field('Recibido por', esc(receivedByName))}
  </div>

  <h2>2. Equipo recibido</h2>
  <div class="equip-grid">
    <div class="equip-col">
      ${field('Marca / Modelo', esc(devName))}
      ${field('Accesorios', plainList(accessoryList))}
      ${field('Estado', plainList(conditionList))}
      ${field('Chequeos / notas generales', esc(issue) || '<span style="color:#999">&mdash;</span>')}
    </div>
    <div class="equip-col">
      ${field('PIN / contrasena', esc(pin))}
      <div class="field">
        <div class="lbl">Patron de desbloqueo</div>
        ${order?.pattern?.length > 0 ? patternSvg(order.pattern) : '<div style="font-size:10pt;color:#999">Sin patron</div>'}
      </div>
    </div>
  </div>

  <h2>3. Reparacion</h2>
  ${field('Tipo de arreglo', plainList(fixList), { full: true })}
  <div class="grid2">
    ${field('Presupuesto', `<span class="val-price">${esc(priceStr) || '&mdash;'}</span>`)}
    ${order?.advance > 0 ? field('Sena recibida', `<span class="val-price">${esc(advanceStr)}</span>`) : ''}
  </div>

  <h2>4. Condiciones</h2>
  <ol class="legal-list">
    ${contractBullets.map((b) => `<li>${esc(b)}</li>`).join('\n    ')}
  </ol>

</div>

<div class="signatures">
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

</body>
</html>`
}
