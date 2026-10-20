// ============================================
// Utilidades de persistencia local (token, sesión y tema)
// ============================================

export const SESSION_KEY = 'service_session_v1'
const THEME_KEY = 'service_theme_v1'
const LAST_PROFILE_KEY = 'service_last_profile_v1'

// Decodifica y verifica si el token JWT ya expiró sin necesidad de consultar al servidor.
export function isTokenExpired(token) {
  if (!token || typeof token !== 'string') return true
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) {
      base64 += '='
    }
    const atobFn = typeof atob === 'function' ? atob : (s) => Buffer.from(s, 'base64').toString('binary')
    const payload = JSON.parse(atobFn(base64))
    if (!payload.exp) return false
    return payload.exp * 1000 <= Date.now()
  } catch {
    return true
  }
}

// Sesión: { token, user } del usuario autenticado.
export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session || !session.token || isTokenExpired(session.token)) {
      clearSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

// Último perfil elegido en el login de este dispositivo.
export function loadLastProfile() {
  return localStorage.getItem(LAST_PROFILE_KEY) || null
}

export function saveLastProfile(profileId) {
  if (profileId) localStorage.setItem(LAST_PROFILE_KEY, profileId)
  else localStorage.removeItem(LAST_PROFILE_KEY)
}

// Tema claro/oscuro.
export function loadTheme() {
  return localStorage.getItem(THEME_KEY) || 'light'
}

export function saveTheme(mode) {
  localStorage.setItem(THEME_KEY, mode)
}
