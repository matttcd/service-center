import { useState, useEffect, useRef } from 'react'
import { X, User, Users, Printer, CheckCircle2, Loader2 } from 'lucide-react'
import { api } from '../utils/api.js'
import { loadSession } from '../utils/storage.js'

let stack = 0

export default function PickupModal({ open, onClose, onConfirm, order }) {
  const [pickupBy, setPickupBy] = useState('client')
  const [pickupName, setPickupName] = useState('')
  const [pickupDni, setPickupDni] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [printing, setPrinting] = useState(false)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onConfirmRef = useRef(onConfirm)
  onConfirmRef.current = onConfirm

  useEffect(() => {
    if (!open) return
    setPickupBy('client')
    setPickupName('')
    setPickupDni('')
    setError('')
    setSaving(false)
    setSaved(false)
    setPrinting(false)
    stack += 1
    const myDepth = stack
    const onKey = (e) => {
      if (e.key === 'Escape' && stack === myDepth) onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      stack -= 1
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!open) return null

  const handleConfirm = async () => {
    if (pickupBy === 'third') {
      if (!pickupName.trim()) return setError('Ingresá el nombre de quien retira.')
      if (!pickupDni.trim()) return setError('Ingresá el DNI de quien retira.')
    }
    setSaving(true)
    setError('')
    try {
      await api(`/orders/${order.id}/pickup`, {
        method: 'POST',
        body: { pickupBy, pickupName: pickupName.trim(), pickupDni: pickupDni.trim() }
      })
      setSaved(true)
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.')
      setSaving(false)
    }
  }

  const handleFinish = () => {
    if (onConfirmRef.current) onConfirmRef.current()
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
      window.open(url, '_blank')
    } catch {
      // ignore
    }
    setPrinting(false)
  }

  const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
  const labelCls = 'mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300">
          <X size={18} />
        </button>

        {!saved ? (
          <>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Retiro del equipo</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">¿Quién retira el equipo?</p>

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
                  <input type="text" value={pickupDni} onChange={(e) => setPickupDni(e.target.value)} className={inputCls} placeholder="DNI de quien retira" />
                </div>
              </div>
            )}

            {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
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
              <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">Equipo entregado</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {pickupBy === 'third'
                  ? `Retirado por ${pickupName.trim()} (DNI ${pickupDni.trim()})`
                  : 'Retirado por el titular'}
              </p>
            </div>

            <div className="mt-5 flex justify-center gap-2">
              <button
                onClick={handlePrint}
                disabled={printing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                Imprimir orden de retiro
              </button>
              <button onClick={handleFinish} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700">
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
