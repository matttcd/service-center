// ============================================
// Contexto de autenticación
// ============================================
import { createContext, useCallback, useContext, useState } from 'react'
import { clearSession, loadSession, saveLastProfile, saveSession } from '../utils/storage.js'
import { api } from '../utils/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => loadSession()?.user || null)

  // Valida credenciales contra la API y guarda la sesión.
  const login = useCallback(async (profileId, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { profileId, password } })
    const user = { ...data.user, mustChangePassword: !!data.mustChangePassword }
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

  // Quita la marca de "cambiar contraseña" una vez que el usuario la cambia.
  const clearMustChangePassword = useCallback(() => {
    const s = loadSession()
    if (!s) return
    const user = { ...s.user, mustChangePassword: false }
    saveSession({ token: s.token, user })
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