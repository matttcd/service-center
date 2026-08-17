// ============================================
// Envío de mensajes por WhatsApp (GreenAPI)
// ============================================

const BASE_URL = 'https://api.green-api.com'

// Reemplaza las variables {cliente}, {dispositivo}, {orden}, {local} de la plantilla.
export function renderTemplate(template, vars) {
  return String(template || '')
    .replace(/\{cliente\}/g, vars.cliente || '')
    .replace(/\{dispositivo\}/g, vars.dispositivo || '')
    .replace(/\{orden\}/g, vars.orden || '')
    .replace(/\{local\}/g, vars.local || '')
}

// Normaliza un teléfono local al formato WhatsApp de Argentina (549 + área +
// número, sin 0 ni 15). Devuelve null si no hay dígitos suficientes.
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (!d) return null
  // Si ya viene con el prefijo 549 completo, se usa tal cual.
  if (d.startsWith('549') && d.length >= 12) return d
  // Con prefijo 54 pero sin el 9 (raro): se le agrega el 9.
  if (d.startsWith('54') && d.length === 12) return '549' + d.slice(2)
  // Sin prefijo de país: "11 5555 4444" (10 dígitos) o con 0 inicial.
  d = d.replace(/^0+/, '')
  if (d.length === 10) return '549' + d
  if (d.startsWith('9') && d.length === 10) return '54' + d
  return d.length >= 8 ? d : null
}

// Envía un mensaje de texto. Devuelve { ok, error }.
export async function sendWhatsApp({ instanceId, apiToken, chatId, message }) {
  if (!instanceId || !apiToken) {
    return { ok: false, error: 'WhatsApp no configurado. Cargá las credenciales en Configuración.' }
  }
  if (!chatId) {
    return { ok: false, error: 'El cliente no tiene teléfono válido para WhatsApp.' }
  }
  try {
    const res = await fetch(
      `${BASE_URL}/waInstance${instanceId}/sendMessage/${apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${chatId}@c.us`, message }),
      },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: data?.details || data?.message || `Error GreenAPI (${res.status})` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: `No se pudo contactar a WhatsApp: ${e.message}` }
  }
}