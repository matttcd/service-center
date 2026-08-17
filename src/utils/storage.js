// ============================================
// Utilidades de persistencia local (token, sesión y tema)
// ============================================

const SESSION_KEY = 'service_session_v1'
const THEME_KEY = 'service_theme_v1'

// Sesión: { token, user } del usuario autenticado.
export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))
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

// Tema claro/oscuro.
export function loadTheme() {
  return localStorage.getItem(THEME_KEY) || 'light'
}

export function saveTheme(mode) {
  localStorage.setItem(THEME_KEY, mode)
}