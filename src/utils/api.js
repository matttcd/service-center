// ============================================
// Cliente HTTP para la API REST
// ============================================
import { loadSession } from './storage.js'

// Llama a un endpoint de la API con el token de sesión.
export async function api(path, { method = 'GET', body } = {}) {
  const session = loadSession()
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (session?.token) headers.Authorization = `Bearer ${session.token}`

  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw Object.assign(new Error('No se pudo conectar con el servidor.'), { status: 0 })
  }

  let data = {}
  try {
    data = await res.json()
  } catch {
    // Sin cuerpo de respuesta.
  }

  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}