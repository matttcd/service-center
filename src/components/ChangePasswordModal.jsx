// ============================================
// ChangePasswordModal: cambio de contraseña obligatorio
// (aparece cuando el login detecta una contraseña por defecto)
// ============================================
import { useState } from 'react'
import { KeyRound, AlertCircle } from 'lucide-react'
import Modal from './Modal.jsx'
import { api } from '../utils/api.js'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
const labelCls = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300'

export default function ChangePasswordModal({ open, onDone }) {
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setError('')
    if (!current) return setError('Ingresá tu contraseña actual.')
    if (password.length < 4) return setError('La contraseña nueva debe tener al menos 4 caracteres.')
    if (password !== confirm) return setError('Las contraseñas nuevas no coinciden.')
    setSaving(true)
    try {
      await api('/auth/change-password', { method: 'POST', body: { current, password } })
      setSaving(false)
      onDone()
    } catch (err) {
      setSaving(false)
      setError(err.message)
    }
  }

  return (
    <Modal open={open} onClose={() => {}} title="Cambiar contraseña" maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
          <KeyRound size={16} className="mt-0.5 shrink-0 text-primary-500" />
          Estás usando una contraseña por defecto. Cambiala para poder seguir trabajando con el sistema.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Contraseña actual</label>
            <input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••••"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Nueva contraseña</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 4 caracteres"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Repetir nueva contraseña</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••"
              className={inputCls}
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
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            <KeyRound size={16} />
            {saving ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </Modal>
  )
}