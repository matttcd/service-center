// ============================================
// ProfileSwitchModal: pide la contraseña para
// cambiar de perfil desde el sidebar
// ============================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Loader2, LogIn, ShieldCheck, Shield, Wrench } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Modal from './Modal.jsx'
import { ROLE_LABEL } from '../utils/helpers.js'

function RoleIcon({ role }) {
  if (role === 'admin') return <ShieldCheck size={12} />
  if (role === 'tecnico') return <Wrench size={12} />
  return <Shield size={12} />
}

export default function ProfileSwitchModal({ profile, onClose }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!password) return setError('Ingresá tu contraseña.')
    setBusy(true)
    try {
      await login(profile.id, password)
      onClose()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const initials = (name) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('')

  return (
    <Modal open={!!profile} onClose={onClose} title="Cambiar de perfil">
      {profile && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
              {initials(profile.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900 dark:text-white">{profile.name}</p>
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  profile.role === 'admin'
                    ? 'text-primary-600 dark:text-primary-400'
                    : profile.role === 'tecnico'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <RoleIcon role={profile.role} />
                {ROLE_LABEL[profile.role] || profile.role}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Contraseña de {profile.name}
            </label>
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              required
            />
          </div>

          {error && (
            <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
              <AlertCircle size={16} />
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              Cambiar
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}