// ============================================
// OrderForm: alta de una orden de servicio
// Cliente existente o nuevo + uno o varios dispositivos.
// ============================================
import { useEffect, useState } from 'react'
import { Plus, Trash2, UserPlus, Search } from 'lucide-react'
import Modal from './Modal.jsx'
import ConfirmDiscard from './ConfirmDiscard.jsx'
import { useData } from '../context/DataContext.jsx'

const emptyItem = () => ({
  brand: '',
  model: '',
  imei: '',
  password: '',
  issueDescription: '',
  accessories: '',
  priceEstimate: '',
  advance: '',
})

export default function OrderForm({ open, onClose, onCreated }) {
  const { customers, addCustomer, addOrder } = useData()
  const [mode, setMode] = useState('existing') // 'existing' | 'new'
  const [customerId, setCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState({ fullName: '', dni: '', phone: '' })
  const [items, setItems] = useState([emptyItem()])
  const [snapshot, setSnapshot] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode('existing')
    setCustomerId(customers[0]?.id || '')
    setNewCustomer({ fullName: '', dni: '', phone: '' })
    setItems([emptyItem()])
    setError('')
    setConfirming(false)
    setSnapshot('')
  }, [open, customers])

  const dirty = items.some((i) => i.model || i.brand || i.issueDescription) || mode === 'new' || snapshot

  const requestClose = () => {
    if (dirty && !confirming) {
      setConfirming(true)
      return
    }
    onClose()
  }

  const setItem = (idx, key) => (e) => {
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, [key]: e.target.value } : it)))
    setError('')
  }

  const addItem = () => setItems((list) => [...list, emptyItem()])

  const removeItem = (idx) => setItems((list) => (list.length > 1 ? list.filter((_, i) => i !== idx) : list))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (mode === 'new' && !newCustomer.fullName.trim()) {
      return setError('Ingresá el nombre del cliente nuevo.')
    }
    const cleanItems = items.filter((i) => i.brand.trim() || i.model.trim())
    if (!cleanItems.length) {
      return setError('Agregá al menos un dispositivo con marca o modelo.')
    }
    setSaving(true)
    setError('')
    try {
      let cid = customerId
      if (mode === 'new') {
        const res = await addCustomer({ ...newCustomer, phone2: '', email: '', address: '' })
        if (res.error) throw new Error(res.error)
        cid = res.id
      }
      const res = await addOrder({
        customerId: cid,
        items: cleanItems.map((i) => ({
          ...i,
          priceEstimate: Number(i.priceEstimate) || 0,
          advance: Number(i.advance) || 0,
        })),
      })
      if (res.error) throw new Error(res.error)
      onClose()
      onCreated(res.order)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  const setNew = (key) => (e) => {
    setNewCustomer((f) => ({ ...f, [key]: e.target.value }))
    setError('')
  }

  return (
    <Modal open={open} onClose={requestClose} title="Nueva orden de servicio" maxWidth="max-w-3xl">
      {confirming ? (
        <ConfirmDiscard
          onStay={() => setConfirming(false)}
          onDiscard={onClose}
          message="La orden todavía no se guardó. Si salís, los datos que escribiste se perderán."
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Cliente */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Search size={15} />
              Cliente
            </div>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  mode === 'existing'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Existente
              </button>
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  mode === 'new'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <UserPlus size={13} />
                Nuevo
              </button>
            </div>

            {mode === 'existing' ? (
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} {c.dni ? `· DNI ${c.dni}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input type="text" value={newCustomer.fullName} onChange={setNew('fullName')} placeholder="Nombre completo *" className={inputCls} />
                <input type="text" inputMode="numeric" value={newCustomer.dni} onChange={setNew('dni')} placeholder="DNI" className={inputCls} />
                <input type="tel" value={newCustomer.phone} onChange={setNew('phone')} placeholder="Teléfono (para WhatsApp)" className={inputCls} />
              </div>
            )}
          </div>

          {/* Dispositivos */}
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Dispositivos a reparar
            </div>
            <div className="space-y-4">
              {items.map((it, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Dispositivo {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <Trash2 size={13} />
                      Quitar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input type="text" value={it.brand} onChange={setItem(idx, 'brand')} placeholder="Marca (ej: Samsung)" className={inputCls} />
                    <input type="text" value={it.model} onChange={setItem(idx, 'model')} placeholder="Modelo (ej: Galaxy A15)" className={inputCls} />
                    <input type="text" value={it.imei} onChange={setItem(idx, 'imei')} placeholder="IMEI" className={inputCls} />
                    <input type="text" value={it.password} onChange={setItem(idx, 'password')} placeholder="Contraseña / patrón" className={inputCls} />
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input type="text" value={it.issueDescription} onChange={setItem(idx, 'issueDescription')} placeholder="Problema reportado" className={inputCls} />
                    <input type="text" value={it.accessories} onChange={setItem(idx, 'accessories')} placeholder="Accesorios entregados" className={inputCls} />
                    <input type="number" min="0" step="0.01" value={it.priceEstimate} onChange={setItem(idx, 'priceEstimate')} placeholder="Costo estimado ($)" className={inputCls} />
                    <input type="number" min="0" step="0.01" value={it.advance} onChange={setItem(idx, 'advance')} placeholder="Seña recibida ($)" className={inputCls} />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Plus size={15} />
              Agregar otro dispositivo
            </button>
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
              disabled={saving}
              className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar e imprimir orden'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}