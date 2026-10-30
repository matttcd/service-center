import { formatDni, normalizeDni } from '../utils/helpers.js'
import Modal from './Modal.jsx'
import { useFormDraft } from '../utils/useFormDraft.js'
import { useNotify } from '../context/notifications.js'
import { useState, useEffect, useRef } from 'react'
import { User, Users, Printer, CheckCircle2, Loader2 } from 'lucide-react'
import { loadSession } from '../utils/storage.js'


export default function PickupModal({ open, onClose, onConfirm, order, mode = 'normal', draft, onDraftChange }) {
  const [fields, patchFields, clearFields] = useFormDraft({ pickupBy: 'client', pickupName: '', pickupDni: '', receiptMode: mode }, draft, onDraftChange)
  const { pickupBy, pickupName, pickupDni, receiptMode } = fields
  const setPickupBy = (value) => patchFields({ pickupBy: value })
  const setPickupName = (value) => patchFields({ pickupName: value })
  const setPickupDni = (value) => patchFields({ pickupDni: value })
  const setError = useNotify('error')
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [completedPickup, setCompletedPickup] = useState(null)
  const [printing, setPrinting] = useState(false)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onConfirmRef = useRef(onConfirm)
  onConfirmRef.current = onConfirm

  useEffect(() => {
    if (!open) return
    setError('')
    setSaving(false)
    setSaved(false)
    setPrinting(false)

  }, [open, setError])

  if (!open) return null

  const handleConfirm = async () => {
    if (savingRef.current) return
    if (pickupBy === 'third') {
      if (!pickupName.trim()) return setError('Ingresá el nombre de quien retira.')
      if (!/^\d{6,8}$/.test(normalizeDni(pickupDni))) return setError('Ingresá un DNI válido de quien retira.')
    }
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const result = await onConfirmRef.current({ pickupBy, pickupName: pickupName.trim(), pickupDni: pickupDni.trim() })
      if (result?.error) throw new Error(result.error)
      setCompletedPickup({ pickupBy, pickupName: pickupName.trim(), pickupDni: normalizeDni(pickupDni), receiptMode })
      clearFields()
      setSaved(true)
    } catch (err) {
      setError(err.message || 'No se pudo guardar. Intentá de nuevo.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleFinish = () => {
    onCloseRef.current()
  }

  const handlePrint = async () => {
    setPrinting(true)
    try {
      const session = loadSession()
      const headers = {}
      if (session?.token) headers.Authorization = `Bearer ${session.token}`
      const res = await fetch(`/api/orders/${order.id}/pickup-pdf`, { headers })
      if (!res.ok) throw new Error('No se pudo generar el PDF')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const popup = window.open(url, '_blank')
      if (!popup) { URL.revokeObjectURL(url); throw new Error('Permití ventanas emergentes para abrir la constancia.') }
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      setError(err.message || 'No se pudo abrir la constancia de retiro.')
    }
    setPrinting(false)
  }

  const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
  const labelCls = 'mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400'

  return (
    <Modal open={open} dismissible={!saving} onClose={onClose} title={saved ? 'Equipo entregado' : 'Retiro del equipo'} maxWidth="max-w-md" zIndex="z-[60]">
        {!saved ? (
          <>
            <fieldset disabled={saving}><legend className="mb-2 text-sm">Comprobante</legend><div className="ws-buttons justify-start">{[['normal', 'Con orden'], ['sin-orden', 'Sin orden']].map(([value, label]) => <button type="button" key={value} className={`ws-button ${receiptMode === value ? 'primary' : ''}`} aria-pressed={receiptMode === value} onClick={() => patchFields({ receiptMode: value })}>{label}</button>)}</div></fieldset><p className="mt-5 text-sm">¿Quién retira el equipo?</p>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPickupBy('client')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                  pickupBy === 'client'
                    ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-500/40 dark:bg-primary-500/15 dark:text-primary-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <User size={16} />
                El cliente
              </button>
              <button
                onClick={() => setPickupBy('third')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                  pickupBy === 'third'
                    ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-500/40 dark:bg-primary-500/15 dark:text-primary-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <Users size={16} />
                Otra persona
              </button>
            </div>

            {pickupBy === 'third' && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className={labelCls}>Nombre completo</label>
                  <input type="text" value={pickupName} onChange={(e) => setPickupName(e.target.value)} className={inputCls} placeholder="Nombre de quien retira" />
                </div>
                <div>
                  <label className={labelCls}>DNI</label>
                  <input type="text" inputMode="numeric" value={formatDni(pickupDni)} onChange={(e) => setPickupDni(normalizeDni(e.target.value))} className={inputCls} placeholder="DNI de quien retira" />
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button onClick={handleConfirm} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Confirmar entrega
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {completedPickup?.pickupBy === 'third'
                  ? `Retirado por ${completedPickup.pickupName} (DNI ${formatDni(completedPickup.pickupDni)})`
                  : 'Retirado por el titular'}
              </p>
            </div>

            <div className="mt-5 flex justify-center gap-2">
              {completedPickup?.receiptMode === 'sin-orden' && (
                <button
                  onClick={handlePrint}
                  disabled={printing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                  Imprimir constancia de retiro
                </button>
              )}
              <button onClick={handleFinish} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700">
                Cerrar
              </button>
            </div>
          </>
        )}
    </Modal>
  )
}
