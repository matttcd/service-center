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

export function buildPickupHtml(order, customer, pickup) {
  const custName = customer?.fullName || order?.customerName || ''
  const dni = customer?.dni || ''
  const devName = `${titleCase(order?.brand || '')} ${titleCase(order?.model || '')}`.trim()
  const accessoryList = (order?.accessories || '').split(',').map((s) => s.trim()).filter(Boolean)
  const conditionList = (order?.conditions || '').split(',').map((s) => s.trim()).filter(Boolean)
  const fixList = (order?.fix || '').split(',').map((s) => s.trim()).filter(Boolean)

  const isThird = pickup?.pickupBy === 'third'
  const pickupName = isThird ? (pickup?.pickupName || '') : custName
  const pickupDni = isThird ? (pickup?.pickupDni || '') : dni

  const date = formatDateTime(new Date().toISOString())

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; }
  .page { width: 210mm; padding: 14mm 14mm 28mm 14mm; }

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

  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1mm 5mm; margin-bottom: 3mm; }

  .note { background: #f8f8f8; border: 1px solid #ddd; border-radius: 3mm; padding: 3mm 4mm; font-size: 9.5pt; color: #555; margin-bottom: 3mm; line-height: 1.4; }

  .signatures { position: fixed; bottom: 14mm; left: 14mm; right: 14mm; display: flex; gap: 6mm; }
  .sig-block { flex: 1; border: 0.5px solid #ccc; border-radius: 2mm; padding: 3mm 4mm; }
  .sig-block-title { font-size: 7.5pt; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin-bottom: 2mm; padding-bottom: 1.5mm; border-bottom: 0.5px solid #ddd; }
  .sig-row { display: flex; gap: 3mm; }
  .sig-col { flex: 1; text-align: center; }
  .sig-col .sig-line { border-top: 0.5px solid #333; margin-top: 10mm; margin-bottom: 1.5mm; }
  .sig-col .sig-label { font-size: 7pt; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .sig-col .sig-hint { font-size: 6.5pt; color: #aaa; margin-top: 0.5mm; }
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
      <div class="doc-title">Orden de Retiro</div>
      <div class="order-num">${esc(order?.orderNumber || '')}</div>
      <div class="order-date">${date}</div>
    </div>
  </div>
  <hr class="simple">

  <h2>Datos del equipo</h2>
  <div class="grid2">
    <div class="field">
      <div class="lbl">Marca / Modelo</div>
      <div class="val">${esc(devName)}</div>
    </div>
    <div class="field">
      <div class="lbl">Accesorios</div>
      <div class="val">${plainList(accessoryList)}</div>
    </div>
  </div>
  <div class="grid2">
    <div class="field">
      <div class="lbl">Estado</div>
      <div class="val">${plainList(conditionList)}</div>
    </div>
    <div class="field">
      <div class="lbl">Reparacion realizada</div>
      <div class="val">${plainList(fixList)}</div>
    </div>
  </div>

  <h2>Quien retira</h2>
  <div class="grid2">
    <div class="field">
      <div class="lbl">Nombre completo</div>
      <div class="val">${esc(pickupName) || '<span style="color:#999">&mdash;</span>'}</div>
    </div>
    <div class="field">
      <div class="lbl">DNI</div>
      <div class="val">${esc(pickupDni) || '<span style="color:#999">&mdash;</span>'}</div>
    </div>
  </div>

  ${isThird ? `<div class="note">El equipo es retirado por una persona distinta al titular de la orden de servicio.</div>` : ''}

  <div class="note">
    declaro haber recibido a conformidad el equipo detallado en la presente orden de retiro.
  </div>

</div>

<div class="signatures">
  <div class="sig-block">
    <div class="sig-block-title">Firmas del que retira</div>
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
  <div class="sig-block">
    <div class="sig-block-title">Para uso del local</div>
    <div class="sig-row">
      <div class="sig-col">
        <div class="sig-line">&nbsp;</div>
        <div class="sig-label">Firma</div>
      </div>
      <div class="sig-col">
        <div class="sig-line">&nbsp;</div>
        <div class="sig-label">Sello</div>
      </div>
      <div class="sig-col">
        <div class="sig-line">&nbsp;</div>
        <div class="sig-label">Fecha</div>
        <div class="sig-hint">dd/mm/aaaa</div>
      </div>
    </div>
  </div>
</div>

</body>
</html>`
}
