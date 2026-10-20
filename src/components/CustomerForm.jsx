// ============================================
// CustomerForm: alta o edición de cliente
// ============================================
import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import Modal from './Modal.jsx'
import ConfirmDiscard from './ConfirmDiscard.jsx'
import { isValidEmail, titleCase } from '../utils/helpers.js'

export default function CustomerForm({ open, onClose, onSubmit, initial, serverError }) {
  const [form, setForm] = useState({
    fullName: '',
    dni: '',
    phone: '',
    phone2: '',
    phone3: '',
    email: '',
    address: '',
  })
  const [snapshot, setSnapshot] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [showPhone3, setShowPhone3] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError('')
    setConfirming(false)
    setShowPhone3(!!initial?.phone3)
    const base = initial
      ? {
          fullName: initial.fullName,
          dni: initial.dni,
          phone: initial.phone,
          phone2: initial.phone2 || '',
          phone3: initial.phone3 || '',
          email: initial.email,
          address: initial.address,
        }
      : { fullName: '', dni: '', phone: '', phone2: '', phone3: '', email: '', address: '' }
    setSnapshot(JSON.stringify(base))
    setForm(base)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id])

  const dirty = JSON.stringify(form) !== snapshot

  // Cierre con protección: si hay cambios sin guardar, pide confirmación.
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
    if (saving) return
    if (!form.fullName.trim()) return setError('El nombre completo es obligatorio.')
    if (form.dni && !/^\d{6,8}$/.test(form.dni)) return setError('El DNI debe tener entre 6 y 8 dígitos.')
    if (form.email && !isValidEmail(form.email)) return setError('Ingresá un email válido.')
    setSaving(true)
    const result = await onSubmit({
      ...form,
      fullName: titleCase(form.fullName),
      address: titleCase(form.address),
    })
    setSaving(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    onClose()
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={initial ? 'Editar cliente' : 'Nuevo cliente'}
    >
      {confirming ? (
        <ConfirmDiscard
          onStay={() => setConfirming(false)}
          onDiscard={onClose}
          message="Hay cambios sin guardar en este cliente. Si salís, se perderán."
        />
      ) : (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Nombre completo *
          </label>
          <input
            type="text"
            value={form.fullName}
            onChange={set('fullName')}
            placeholder="Ej: Ana Martínez"
            className={inputCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              DNI
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={form.dni}
              onChange={set('dni')}
              placeholder="12345678"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Teléfono
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="1155556677"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Teléfono 2
          </label>
          <input
            type="tel"
            value={form.phone2}
            onChange={set('phone2')}
            placeholder="1155667788"
            className={inputCls}
          />
        </div>
        {showPhone3 ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Teléfono 3
            </label>
            <input
              type="tel"
              value={form.phone3}
              onChange={set('phone3')}
              placeholder="1155998877"
              className={inputCls}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowPhone3(true)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 transition hover:text-primary-700"
          >
            <Plus size={15} />
            Agregar otro teléfono
          </button>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="cliente@mail.com"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Dirección
          </label>
          <input
            type="text"
            value={form.address}
            onChange={set('address')}
            placeholder="Calle 123, Ciudad"
            className={inputCls}
          />
        </div>

        {(error || serverError) && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error || serverError}
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
            disabled={saving}
            className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : initial ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </div>
      </form>
      )}
    </Modal>
  )
}