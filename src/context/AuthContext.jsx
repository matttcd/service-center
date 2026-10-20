// ============================================
// Contexto de autenticación
// ============================================
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { clearSession, loadSession, saveLastProfile, saveSession, SESSION_KEY } from '../utils/storage.js'
import { SESSION_EXPIRED_EVENT } from '../utils/sessionEvents.js'
import { api } from '../utils/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => loadSession()?.user || null)

  // Valida credenciales contra la API y guarda la sesión.
  const login = useCallback(async (profileId, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { profileId, password } })
    const user = { ...data.user, mustChangePassword: !!data.user.mustChangePassword }
    saveSession({ token: data.token, user })
    saveLastProfile(profileId)
    setCurrentUser(user)
    return user
  }, [])

  // Cierra la sesión local (sin llamar al servidor).
  const logout = useCallback(() => {
    clearSession()
    setCurrentUser(null)
  }, [])
  useEffect(() => {
    const onStorage = (event) => { if (event.key === SESSION_KEY) setCurrentUser(loadSession()?.user || null) }
    const checkExpiration = () => { if (!loadSession()) logout() }
    window.addEventListener(SESSION_EXPIRED_EVENT, logout)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', checkExpiration)
    const timer = setInterval(checkExpiration, 60000)
    return () => {
      clearInterval(timer)
      window.removeEventListener(SESSION_EXPIRED_EVENT, logout)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', checkExpiration)
    }
  }, [logout])

  // Quita la marca de "cambiar contraseña" una vez que el usuario la cambia.
  const clearMustChangePassword = useCallback((token) => {
    const s = loadSession()
    if (!s) return
    const user = { ...s.user, mustChangePassword: false }
    saveSession({ token: token || s.token, user })
    setCurrentUser(user)
  }, [])

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
