// ============================================
// OrderForm: alta de una orden de servicio (un solo dispositivo)
// Marcas/modelos con badges del catálogo + "otro" (búsqueda y alta en BD).
// ============================================
import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, UserPlus, ListPlus, X } from 'lucide-react'
import Modal from './Modal.jsx'
import ConfirmDiscard from './ConfirmDiscard.jsx'
import PatternPad from './PatternPad.jsx'
import { useData } from '../context/DataContext.jsx'
import {
  COMMON_ACCESSORIES,
  COMMON_FIXES,
  BRAND_BADGE_COUNT,
  MODEL_BADGE_COUNT,
} from '../utils/constants.js'

const chipSelected =
  'inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700'
const chipIdle =
  'inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
const chipAdd =
  'inline-flex items-center gap-1 rounded-full border border-dashed border-primary-400 px-3 py-1.5 text-xs font-semibold text-primary-600 transition hover:bg-primary-50 dark:border-primary-500/40 dark:text-primary-400 dark:hover:bg-primary-500/10'

export default function OrderForm({ open, onClose, onCreated }) {
  const { customers, catalog, addCustomer, addOrder, addCatalogBrand, addCatalogModel } = useData()
  const [mode, setMode] = useState('existing') // 'existing' | 'new'
  const [customerId, setCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState({ fullName: '', dni: '', phone: '', address: '' })
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [picker, setPicker] = useState(null) // null | 'brand' | 'model'
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerNew, setPickerNew] = useState('')
  const [accessories, setAccessories] = useState([])
  const [customAccessory, setCustomAccessory] = useState('')
  const [pin, setPin] = useState('')
  const [pattern, setPattern] = useState([])
  const [diagnosisType, setDiagnosisType] = useState('revision') // 'visible' | 'revision'
  const [issue, setIssue] = useState('')
  const [fix, setFix] = useState('')
  const [customFix, setCustomFix] = useState('')
  const [price, setPrice] = useState('')
  const [advance, setAdvance] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode('existing')
    setCustomerId(customers[0]?.id || '')
    setNewCustomer({ fullName: '', dni: '', phone: '', address: '' })
    setBrand('')
    setModel('')
    setPicker(null)
    setPickerQuery('')
    setPickerNew('')
    setAccessories([])
    setCustomAccessory('')
    setPin('')
    setPattern([])
setDiagnosisType('revision')
    setIssue('')
    setFix('')
    setCustomFix('')
    setPrice('')
    setAdvance('')
    setError('')
    setConfirming(false)
  }, [open, customers])

  // Badges de marcas y modelos según el catálogo (ordenado por uso).
  const topBrands = useMemo(() => (catalog.brands || []).slice(0, BRAND_BADGE_COUNT), [catalog.brands])
  const brandModels = useMemo(
    () => (catalog.models || []).filter((m) => m.brand === brand).slice(0, MODEL_BADGE_COUNT),
    [catalog.models, brand],
  )
  const allBrandModels = useMemo(
    () => (catalog.models || []).filter((m) => m.brand === brand),
    [catalog.models, brand],
  )

  const pickerList = picker === 'brand' ? catalog.brands || [] : allBrandModels
  const pickerFiltered = pickerList.filter((x) =>
    x.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()),
  )

  const dirty =
    mode === 'new' ||
    !!brand ||
    !!model ||
    !!issue ||
    !!price ||
    !!advance ||
    accessories.length > 0 ||
    !!customAccessory ||
    !!pin ||
    pattern.length > 0 ||
    !!fix ||
    !!customFix

  const requestClose = () => {
    if (dirty && !confirming) {
      setConfirming(true)
      return
    }
    onClose()
  }

  const toggleAccessory = (name) =>
    setAccessories((list) =>
      list.includes(name) ? list.filter((a) => a !== name) : [...list, name],
    )

  const addCustomAccessory = () => {
    const v = customAccessory.trim()
    if (!v) return
    setAccessories((list) => (list.includes(v) ? list : [...list, v]))
    setCustomAccessory('')
  }

  const addFromPicker = (name) => {
    if (picker === 'brand') {
      setBrand(name)
      setModel('')
    } else {
      setModel(name)
    }
    setPicker(null)
    setPickerQuery('')
    setPickerNew('')
  }

  const addNewPickerItem = async () => {
    const v = pickerNew.trim()
    if (!v) return
    if (picker === 'brand') {
      const res = await addCatalogBrand(v)
      if (res.error) return setError(res.error)
      addFromPicker(res.brand.name)
    } else {
      if (!brand) return setError('Elegí primero la marca.')
      const res = await addCatalogModel(brand, v)
      if (res.error) return setError(res.error)
      addFromPicker(res.model.name)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    let cid = customerId
    if (mode === 'new') {
      if (!newCustomer.fullName.trim()) return setError('Ingresá el nombre del cliente.')
      const res = await addCustomer({ ...newCustomer, phone2: '', phone3: '', email: '' })
      if (res.error) return setError(res.error)
      cid = res.id
    }
    if (!brand) return setError('Elegí la marca del dispositivo.')
    if (!model) return setError('Elegí el modelo del dispositivo.')
    if (diagnosisType === 'visible' && Number(price) <= 0) {
      return setError('Para un problema visible ingresá el presupuesto del arreglo.')
    }
    setSaving(true)
    setError('')
    try {
      const accList = [...accessories, customAccessory.trim()].filter(Boolean)
      const res = await addOrder({
        customerId: cid,
        brand,
        model,
        accessories: accList.join(', '),
        pin: pin.trim(),
        pattern: pattern.length >= 3 ? pattern : null,
        diagnosisType,
        issue: issue.trim(),
        fix: (diagnosisType === 'visible' ? (fix || customFix) : '').trim(),
        price: Number(price) || 0,
        advance: Number(advance) || 0,
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
  const labelCls = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300'

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
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <UserPlus size={15} />
              Cliente
            </div>
            <div className="mb-2 flex gap-2">
              <button type="button" onClick={() => setMode('existing')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === 'existing' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
                Existente
              </button>
              <button type="button" onClick={() => setMode('new')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === 'new' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input type="text" value={newCustomer.fullName} onChange={(e) => setNewCustomer((f) => ({ ...f, fullName: e.target.value }))} placeholder="Nombre completo *" className={inputCls} />
                <input type="text" inputMode="numeric" value={newCustomer.dni} onChange={(e) => setNewCustomer((f) => ({ ...f, dni: e.target.value }))} placeholder="DNI" className={inputCls} />
                <input type="tel" value={newCustomer.phone} onChange={(e) => setNewCustomer((f) => ({ ...f, phone: e.target.value }))} placeholder="Teléfono" className={inputCls} />
                <input type="text" value={newCustomer.address} onChange={(e) => setNewCustomer((f) => ({ ...f, address: e.target.value }))} placeholder="Domicilio" className={inputCls} />
              </div>
            )}
          </div>

          {/* Dispositivo */}
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Marca</label>
              <div className="flex flex-wrap items-center gap-2">
                {topBrands.map((b) => (
                  <button key={b.id} type="button" onClick={() => { setBrand(b.name); setModel('') }}
                    className={brand === b.name ? chipSelected : chipIdle}>
                    {b.name}
                  </button>
                ))}
                <button type="button" onClick={() => { setPicker('brand'); setPickerQuery(''); setPickerNew('') }}
                  className={chipAdd}>
                  <ListPlus size={13} />
                  Otra
                </button>
                {brand && !topBrands.some((b) => b.name === brand) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white">
                    {brand}
                    <button type="button" onClick={() => { setBrand(''); setModel('') }} aria-label="Quitar marca">
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className={labelCls}>Modelo</label>
              <div className="flex flex-wrap items-center gap-2">
                {brand ? (
                  brandModels.length ? (
                    brandModels.map((m) => (
                      <button key={m.id} type="button" onClick={() => setModel(m.name)}
                        className={model === m.name ? chipSelected : chipIdle}>
                        {m.name}
                      </button>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">Sin modelos cargados para {brand}.</span>
                  )
                ) : (
                  <span className="text-sm text-slate-400">Elegí primero la marca.</span>
                )}
                {brand && (
                  <button type="button" onClick={() => { setPicker('model'); setPickerQuery(''); setPickerNew('') }}
                    className={chipAdd}>
                    <ListPlus size={13} />
                    Otro
                  </button>
                )}
                {model && !brandModels.some((m) => m.name === model) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white">
                    {model}
                    <button type="button" onClick={() => setModel('')} aria-label="Quitar modelo">
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>PIN / contraseña</label>
                <input type="text" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Si te lo dejan configurado" className={inputCls} />
                <p className="mt-1 text-xs text-slate-400">Dejá en blanco si no tiene.</p>
              </div>
              <div>
                <label className={labelCls}>Accesorios que deja</label>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {COMMON_ACCESSORIES.map((a) => (
                    <button key={a} type="button" onClick={() => toggleAccessory(a)}
                      className={accessories.includes(a) ? chipSelected : chipIdle}>
                      {a}
                    </button>
                  ))}
                  <span className="flex items-center gap-1">
                    <input type="text" value={customAccessory} onChange={(e) => setCustomAccessory(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomAccessory() } }}
                      placeholder="Otro..." className={`${inputCls} !w-28`} />
                    <button type="button" onClick={addCustomAccessory} className={chipIdle}>
                      <Plus size={13} />
                    </button>
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>Patrón de desbloqueo</label>
              <PatternPad value={pattern} onChange={setPattern} />
            </div>
          </div>

          {/* Ingreso */}
          <div>
            <label className={labelCls}>Ingreso del equipo</label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setDiagnosisType('revision')}
                className={diagnosisType === 'revision' ? chipSelected : chipIdle}>
                Revisión
              </button>
              <button type="button" onClick={() => setDiagnosisType('visible')}
                className={diagnosisType === 'visible' ? chipSelected : chipIdle}>
                Reparación directa
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>Problema reportado</label>
            <textarea value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Motivo de ingreso, chequeos y notas generales..." className={inputCls} rows={3} />
          </div>

          {diagnosisType === 'visible' && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Arreglo a realizar</label>
                <div className="flex flex-wrap items-center gap-2">
                  {COMMON_FIXES.map((f) => (
                    <button key={f} type="button" onClick={() => { setFix(f); setCustomFix('') }}
                      className={(fix || customFix) === f ? chipSelected : chipIdle}>
                      {f}
                    </button>
                  ))}
                  <input type="text" value={customFix} onChange={(e) => { setCustomFix(e.target.value); setFix('') }}
                    placeholder="Otro arreglo..." className={`${inputCls} !w-40`} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Presupuesto ($)</label>
                  <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Costo del arreglo" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Seña ($)</label>
                  <input type="number" min="0" step="0.01" value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="Opcional" className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={requestClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          {/* Picker "otro" de marca/modelo */}
          <Modal
            open={!!picker}
            onClose={() => setPicker(null)}
            title={picker === 'brand' ? 'Elegir marca' : `Elegir modelo (${brand})`}
          >
            <div className="space-y-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Buscar..."
                  className={`${inputCls} pl-9`}
                  autoFocus
                />
              </div>

              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                {pickerFiltered.length === 0 && (
                  <p className="px-2 py-3 text-center text-sm text-slate-400">No hay resultados.</p>
                )}
                {pickerFiltered.map((x) => (
                  <button key={x.id} type="button" onClick={() => addFromPicker(x.name)}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-primary-50 dark:text-slate-200 dark:hover:bg-primary-500/10">
                    {x.name}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                <input
                  type="text"
                  value={pickerNew}
                  onChange={(e) => setPickerNew(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewPickerItem() } }}
                  placeholder={picker === 'brand' ? 'Marca nueva...' : 'Modelo nuevo...'}
                  className={inputCls}
                />
                <button type="button" onClick={addNewPickerItem}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700">
                  <Plus size={15} />
                  Agregar
                </button>
              </div>
            </div>
          </Modal>
        </form>
      )}
    </Modal>
  )
}