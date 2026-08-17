// ============================================
// Login: pantalla de inicio de sesión
// ============================================
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { LogIn, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { BRAND_NAME, BRAND_SUBTITLE } from '../utils/brand.js'

export default function Login() {
  const { currentUser, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Si ya hay sesión, redirige al dashboard.
  if (currentUser) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      // Redirige al dashboard (el rol define lo que se muestra).
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md">
        {/* Marca */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-400 text-primary-600 shadow-lg shadow-accent-500/30">
            <span className="text-4xl font-black leading-none">G</span>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{BRAND_NAME}</h1>
            <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">{BRAND_SUBTITLE}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Accedé para gestionar el servicio técnico
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@local.com"
                className={inputCls}
                required
              />
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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white transition hover:bg-primary-700"
            >
              <LogIn size={16} />
              Iniciar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}