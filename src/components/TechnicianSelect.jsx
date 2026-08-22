// ============================================
// TechnicianSelect: dropdown propio para elegir el técnico encargado.
// No usa <select> nativo (su lista se dibuja blanca en modo oscuro).
// ============================================
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Wrench } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import ConfirmModal from './ConfirmModal.jsx'

export default function TechnicianSelect({ order, onChanged }) {
  const { technicians, assignTechnician } = useData()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [alertModal, setAlertModal] = useState(null)
  const boxRef = useRef(null)

  const value = order.assignedTo || ''
  const current = technicians.find((t) => t.id === value)
  const label = current?.name || 'Sin técnico'

  const close = () => setOpen(false)

  // Cierra con click afuera o con Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) close()
    }
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = async (userId) => {
    close()
    if (userId === value) return
    setBusy(true)
    const res = await assignTechnician(order.id, userId)
    setBusy(false)
    if (res.error) setAlertModal(res.error)
    else onChanged?.()
  }

  const options = [{ id: '', name: 'Sin técnico' }, ...technicians]

  return (
    <>
    <div
      ref={boxRef}
      onClick={(e) => e.stopPropagation()}
      className="relative inline-flex"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary-500/30 ${
          value
            ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300'
            : 'border-dashed border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400'
        } ${open ? 'ring-2 ring-primary-500/20' : ''}`}
      >
        <Wrench size={16} className="shrink-0" />
        <span className="whitespace-nowrap">{label}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1.5 min-w-full overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {options.map((t) => {
            const selected = t.id === value
            return (
              <button
                key={t.id || 'none'}
                type="button"
                onClick={() => pick(t.id)}
                className={`flex w-full items-center justify-between gap-2 whitespace-nowrap px-3 py-2 text-left text-sm font-medium transition ${
                  selected
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <span className="truncate">{t.name}</span>
                {selected && <Check size={16} className="shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
    <ConfirmModal
      open={!!alertModal}
      onClose={() => setAlertModal(null)}
      onConfirm={() => setAlertModal(null)}
      title="Aviso"
      message={alertModal}
      type="alert"
    />
    </>
  )
}
