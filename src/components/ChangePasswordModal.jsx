// ============================================
// ChangePasswordModal: cambio de contraseña obligatorio
// (aparece cuando el login detecta una contraseña por defecto)
// ============================================
import { useNotify } from '../context/notifications.js'
import { useId, useState } from 'react'
import { KeyRound } from 'lucide-react'
import Modal from './Modal.jsx'
import { api } from '../utils/api.js'

export default function ChangePasswordModal({ open, onDone, required = true, onClose = () => {} }) {
  const fieldId = useId()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const setError = useNotify('error')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setError('')
    if (!current) return setError('Ingresá tu contraseña actual.')
    if (password.length < 8) return setError('La contraseña nueva debe tener al menos 8 caracteres.')
    if (password !== confirm) return setError('Las contraseñas nuevas no coinciden.')
    setSaving(true)
    try {
      const result = await api('/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: password } })
      setSaving(false)
      onDone(result.token)
    } catch (err) {
      setSaving(false)
      setError(err.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} dismissible={!required && !saving} title="Cambiar contraseña" maxWidth="max-w-md">
        <form onSubmit={handleSubmit} className="ws-form">
          <p className="sc-secondary">{required ? 'Cambiá la contraseña inicial para continuar.' : 'Al guardar se cierran las demás sesiones.'}</p>
          <label htmlFor={`${fieldId}-current`}>Contraseña actual
            <input
              id={`${fieldId}-current`}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••••"
            />
          </label>
          <label htmlFor={`${fieldId}-new`}>Nueva contraseña
            <input
              id={`${fieldId}-new`}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </label>
          <label htmlFor={`${fieldId}-confirm`}>Repetir nueva contraseña
            <input
              id={`${fieldId}-confirm`}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••"
            />
          </label>
          <div className="ws-buttons">
          {!required && <button type="button" className="ws-button" onClick={onClose} disabled={saving}>Cancelar</button>}
          <button
            type="submit"
            disabled={saving}
            className="ws-button primary"
          >
            <KeyRound size={16} />
            {saving ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
          </div>
        </form>
    </Modal>
  )
}
