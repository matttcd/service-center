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
    saveSession({ token: data.token, user: data.user })
    saveLastProfile(profileId)
    setCurrentUser(data.user)
    return data.user
  }, [])

  // Cierra la sesión local (sin llamar al servidor).
  const logout = useCallback(() => {
    clearSession()
    setCurrentUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}