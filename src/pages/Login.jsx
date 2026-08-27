// ============================================
// Login: elegí tu perfil y entrá con tu contraseña
// ============================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LogIn, AlertCircle, Loader2, ShieldCheck, Shield, Wrench, RefreshCw, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../utils/api.js'
import { loadLastProfile, saveLastProfile } from '../utils/storage.js'
import { BRAND_NAME, BRAND_SUBTITLE } from '../utils/brand.js'
import logoUrl from '../assets/gringologo-modified.png'
import { ROLE_LABEL } from '../utils/helpers.js'

export default function Login() {
  const { currentUser, login } = useAuth()
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const menuRef = useRef(null)

  const loadProfiles = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await api('/auth/profiles')
      const list = res.profiles || []
      setProfiles(list)
      const last = loadLastProfile()
      const remembered = list.find((p) => p.id === last)
      if (remembered) setSelectedIndex(list.findIndex((p) => p.id === remembered.id))
      else setSelectedIndex(0)
    } catch {
      setLoadError('No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  // Cierra el menú con click afuera o Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const pick = (i) => {
    setSelectedIndex(i)
    setMenuOpen(false)
    setError('')
    setPassword('')
  }

  const selected = useMemo(
    () => profiles[selectedIndex] || null,
    [profiles, selectedIndex],
  )

  // Si ya hay sesión, redirige al dashboard.
  if (currentUser) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    if (!selected) return setError('Elegí tu perfil.')
    if (!password) return setError('Ingresá tu contraseña.')
    setSubmitting(true)
    try {
      await login(selected.id, password)
      saveLastProfile(selected.id)
      // Redirige al dashboard (el rol define lo que se muestra).
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  const initials = (name) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('')

  const RoleIcon = ({ role }) => {
    if (role === 'admin') return <ShieldCheck size={12} />
    if (role === 'tecnico') return <Wrench size={12} />
    return <Shield size={12} />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 dark:bg-slate-950">
      <div className="w-full max-w-md">
        {/* Marca */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <img src={logoUrl} alt="Logo" className="h-14 w-14 rounded-full object-contain shadow-lg shadow-blue-500/30" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{BRAND_NAME}</h1>
            <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">{BRAND_SUBTITLE}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Elegí tu perfil para ingresar
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Loader2 size={28} className="animate-spin text-primary-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Cargando perfiles…</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <AlertCircle size={28} className="text-red-500" />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{loadError}</p>
              <p className="mt-1 text-xs text-slate-400">Verificá que el servidor esté encendido.</p>
            </div>
            <button
              type="button"
              onClick={loadProfiles}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              <RefreshCw size={16} />
              Reintentar
            </button>
          </div>
        ) : profiles.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Todavía no hay perfiles para entrar.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Un administrador debe crear un usuario primero.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Perfil
                </label>
                <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      menuOpen
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20 dark:border-primary-500 dark:bg-primary-500/10'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                      {initials(selected.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">
                        {selected.name}
                      </p>
                      <span
                        className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${
                          selected.role === 'admin'
                            ? 'text-primary-600 dark:text-primary-400'
                            : selected.role === 'tecnico'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <RoleIcon role={selected.role} />
                        {ROLE_LABEL[selected.role] || selected.role}
                      </span>
                    </div>
                    <span className="shrink-0 text-slate-400">
                      <ChevronDown size={18} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                    </span>
                  </button>

                  {menuOpen && (
                    <div className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                      {profiles.map((p, i) => {
                        const isSelected = i === selectedIndex
                        return (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => pick(i)}
                            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                              isSelected
                                ? 'bg-primary-50 dark:bg-primary-500/10'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'
                            }`}
                          >
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                isSelected
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-primary-100 text-primary-600 dark:bg-primary-500/15 dark:text-primary-400'
                              }`}
                            >
                              {initials(p.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-sm font-semibold ${isSelected ? 'text-primary-800 dark:text-primary-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                {p.name}
                              </p>
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                  p.role === 'admin'
                                    ? 'text-primary-600 dark:text-primary-400'
                                    : p.role === 'tecnico'
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-slate-400 dark:text-slate-400'
                                }`}
                              >
                                <RoleIcon role={p.role} />
                                {ROLE_LABEL[p.role] || p.role}
                              </span>
                            </div>
                            {isSelected && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-primary-600" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Contraseña
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className={inputCls}
                  required
                />
              </div>

              {error && (
                <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                  <AlertCircle size={16} />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!selected || submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                {submitting ? 'Ingresando...' : 'Iniciar sesión'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}