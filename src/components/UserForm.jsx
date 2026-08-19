// ============================================
// UserForm: crear un nuevo usuario (solo admin)
// ============================================
import { useState, useEffect } from 'react'
import Modal from './Modal.jsx'
import ConfirmDiscard from './ConfirmDiscard.jsx'
import { isValidEmail } from '../utils/helpers.js'

export default function UserForm({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'mostrador' })
  const [snapshot, setSnapshot] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const base = { name: '', email: '', password: '', role: 'mostrador' }
    setSnapshot(JSON.stringify(base))
    setForm(base)
    setError('')
    setConfirming(false)
  }, [open])

  const dirty = JSON.stringify(form) !== snapshot

  const requestClose = () => {
    if (dirty && !confirming) {
      setConfirming(true)
      return
    }
    onClose()
  }

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('El nombre es obligatorio.')
    if (!isValidEmail(form.email)) return setError('Ingresá un email válido.')
    if (form.password.length < 4) return setError('La contraseña debe tener al menos 4 caracteres.')
    const res = await onSubmit(form)
    if (res && res.error) return setError(res.error)
    onClose()
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  return (
    <Modal open={open} onClose={requestClose} title="Nuevo usuario">
      {confirming ? (
        <ConfirmDiscard
          onStay={() => setConfirming(false)}
          onDiscard={onClose}
          message="El usuario todavía no se creó. Si salís, los datos que escribiste se perderán."
        />
      ) : (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Nombre completo
          </label>
          <input
            type="text"
            value={form.name}
            onChange={set('name')}
            placeholder="Ej: Laura Medina"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="usuario@local.com"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Contraseña
          </label>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder="••••••"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Rol
          </label>
          <select value={form.role} onChange={set('role')} className={inputCls}>
            <option value="mostrador">Empleado (recepción y entrega)</option>
            <option value="tecnico">Técnico (reparación)</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={requestClose}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white transition hover:bg-primary-700"
          >
            Crear usuario
          </button>
        </div>
      </form>
      )}
    </Modal>
  )
}