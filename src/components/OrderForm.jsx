// ============================================
// OrderForm: alta de una orden de servicio (un solo dispositivo)
// Marcas/modelos con badges del catálogo + "otro" (búsqueda y alta en BD).
// ============================================
import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, ListPlus, X, Smartphone, Tablet, Laptop, Monitor, Gamepad2, Printer, HelpCircle } from 'lucide-react'
import Modal from './Modal.jsx'
import ConfirmDiscard from './ConfirmDiscard.jsx'
import PatternPad from './PatternPad.jsx'
import { useData } from '../context/DataContext.jsx'
import { titleCase, sentenceCase } from '../utils/helpers.js'
import {
  BRAND_BADGE_COUNT,
  MODEL_BADGE_COUNT,
} from '../utils/constants.js'
import { DEVICE_TYPES } from '../../shared/fsm.js'
import { api } from '../utils/api.js'

const DEVICE_TYPE_ICONS = {
  'Celular': Smartphone,
  'Tablet': Tablet,
  'Notebook / PC': Laptop,
  'Smart TV': Monitor,
  'Consola': Gamepad2,
  'Impresora': Printer,
  'Otro': HelpCircle,
}

const chipSelected =
  'inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700'
const chipIdle =
  'inline-flex items-center gap-1 rounded-full border border-slate-400 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
const chipAdd =
  'inline-flex items-center gap-1 rounded-full border border-dashed border-primary-400 px-3 py-1.5 text-xs font-semibold text-primary-600 transition hover:bg-primary-50 dark:border-primary-500/40 dark:text-primary-400 dark:hover:bg-primary-500/10'

const ACCESSORY_FALLBACK = ['Funda', 'Cargador', 'Vidrio templado', 'SIM', 'SD', 'Auriculares']
const CONDITION_FALLBACK = ['Apagado', 'Mojado', 'Golpeado', 'Display Roto', 'No se pudo probar funciones básicas']
const FIX_FALLBACK = ['Cambio de pantalla', 'Cambio de módulo', 'Cambio de batería', 'Pin de carga', 'Micrófono', 'Parlante', 'Botón de encendido', 'Flex', 'Software', 'Limpieza']

export default function OrderForm({ open, onClose, onCreated }) {
  const { customers, catalog, addCustomer, addOrder, addCatalogBrand, addCatalogModel, catalogLists } = useData()
  const [custQuery, setCustQuery] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState({ fullName: '', dni: '', phone: '', address: '' })
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [deviceType, setDeviceType] = useState('')
  const [customDeviceType, setCustomDeviceType] = useState('')
  const [picker, setPicker] = useState(null) // null | 'brand' | 'model'
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerNew, setPickerNew] = useState('')
  const [accessories, setAccessories] = useState([])
  const [customAccessory, setCustomAccessory] = useState('')
  const [conditions, setConditions] = useState([])
  const [pin, setPin] = useState('')
  const [noPin, setNoPin] = useState(false)
  const [pattern, setPattern] = useState([])
  const [diagnosisType, setDiagnosisType] = useState('visible') // 'visible' | 'revision'
  const [issue, setIssue] = useState('')
  const [fixes, setFixes] = useState([])
  const [customFix, setCustomFix] = useState('')
  const [price, setPrice] = useState('')
  const [advance, setAdvance] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [filteredCatalog, setFilteredCatalog] = useState({ brands: [], models: [] })

  const accessoryOptions = catalogLists?.accessories?.length ? catalogLists.accessories : ACCESSORY_FALLBACK
  const conditionOptions = catalogLists?.conditions?.length ? catalogLists.conditions : CONDITION_FALLBACK
  const fixOptions = catalogLists?.fixes?.length ? catalogLists.fixes : FIX_FALLBACK

  useEffect(() => {
    if (!open) return
    setCustQuery('')
    setSelectedCustomerId('')
    setNewCustomer({ fullName: '', dni: '', phone: '', address: '' })
    setBrand('')
    setModel('')
    setDeviceType('')
    setCustomDeviceType('')
    setPicker(null)
    setPickerQuery('')
    setPickerNew('')
    setAccessories([])
    setCustomAccessory('')
    setConditions([])
    setPin('')
    setNoPin(false)
setPattern([])
    setDiagnosisType('visible')
setIssue('')
    setFixes([])
    setCustomFix('')
    setPrice('')
    setAdvance('')
    setError('')
    setConfirming(false)
    setFilteredCatalog({ brands: [], models: [] })
  }, [open])

  // Fetch de marcas y modelos cuando cambia el tipo de dispositivo.
  useEffect(() => {
    if (!open || !deviceType || deviceType === 'Otro') {
      setFilteredCatalog({ brands: [], models: [] })
      return
    }
    let cancelled = false
    api(`/catalog?deviceType=${encodeURIComponent(deviceType)}`).then((res) => {
      if (cancelled) return
      if (res && res.brands) setFilteredCatalog({ brands: res.brands, models: res.models || [] })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [open, deviceType])

  // Badges de marcas y modelos según el catálogo (ordenado por uso).
  const filteredBrands = useMemo(() => {
    if (deviceType && deviceType !== 'Otro' && filteredCatalog.brands.length > 0) return filteredCatalog.brands
    return catalog.brands || []
  }, [catalog.brands, deviceType, filteredCatalog.brands])
  const topBrands = useMemo(() => filteredBrands.slice(0, BRAND_BADGE_COUNT), [filteredBrands])
  const brandModels = useMemo(
    () => {
      const models = (deviceType && deviceType !== 'Otro' && filteredCatalog.models.length > 0) ? filteredCatalog.models : (catalog.models || [])
      return models.filter((m) => m.brand === brand).slice(0, MODEL_BADGE_COUNT)
    },
    [catalog.models, brand, deviceType, filteredCatalog.models],
  )
  const allBrandModels = useMemo(
    () => {
      const models = (deviceType && deviceType !== 'Otro' && filteredCatalog.models.length > 0) ? filteredCatalog.models : (catalog.models || [])
      return models.filter((m) => m.brand === brand)
    },
    [catalog.models, brand, deviceType, filteredCatalog.models],
  )

  const pickerList = picker === 'brand' ? filteredBrands : allBrandModels
  const pickerFiltered = pickerList.filter((x) =>
    x.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()),
  )

  // Coincidencias de clientes por nombre o DNI (busca al existente).
  const customerMatches = useMemo(() => {
    const q = custQuery.trim().toLowerCase()
    if (!q) return []
    return customers
      .filter((c) => {
        if (selectedCustomerId && c.id === selectedCustomerId) return false
        return (
          c.fullName.toLowerCase().includes(q) ||
          (c.dni || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q)
        )
      })
      .slice(0, 8)
  }, [customers, custQuery, selectedCustomerId])

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null

  const dirty =
    !!selectedCustomerId ||
    !!custQuery ||
    !!newCustomer.fullName ||
    !!newCustomer.dni ||
    !!newCustomer.phone ||
    !!newCustomer.address ||
    !!brand ||
    !!model ||
    !!deviceType ||
    !!customDeviceType ||
    !!issue ||
    !!price ||
    !!advance ||
    accessories.length > 0 ||
    !!customAccessory ||
    conditions.length > 0 ||
    !!pin ||
    !!noPin ||
    pattern.length > 0 ||
    fixes.length > 0 ||
    !!customFix

  const requestClose = () => {
    if (dirty && !confirming) {
      setConfirming(true)
      return
    }
    onClose()
  }

  const toggleAccessory = (name) =>
    setAccessories((list) => {
      if (list.includes(name)) return list.filter((a) => a !== name)
      if (list.length >= 10) return list
      return [...list, name]
    })

  const toggleFix = (name) =>
    setFixes((list) => {
      if (list.includes(name)) return list.filter((f) => f !== name)
      if (list.length >= 8) return list
      return [...list, name]
    })

  const onAddCustomFix = () => {
    const v = customFix.trim()
    if (!v) return
    setFixes((list) => (list.includes(v) || list.length >= 8 ? list : [...list, v]))
    setCustomFix('')
  }

  const addCustomAccessory = () => {
    const v = customAccessory.trim()
    if (!v) return
    setAccessories((list) => (list.includes(v) || list.length >= 10 ? list : [...list, v]))
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
    if (saving) return
    if (!brand) return setError('Elegí la marca del dispositivo.')
    if (!model) return setError('Elegí el modelo del dispositivo.')
    if (diagnosisType === 'visible' && Number(price) <= 0) {
      return setError('Para un problema visible ingresá el presupuesto del arreglo.')
    }
    if (!selectedCustomerId && !newCustomer.fullName.trim()) {
      return setError('Ingresá el nombre del cliente.')
    }
    setSaving(true)
    setError('')
    try {
      let cid = selectedCustomerId
      if (!cid) {
        const res = await addCustomer({
          ...newCustomer,
          fullName: titleCase(newCustomer.fullName),
          address: titleCase(newCustomer.address),
          phone2: '',
          phone3: '',
          email: '',
        })
        if (res.error) throw new Error(res.error)
        cid = res.id
      }
      const accList = [...accessories, customAccessory.trim()].filter(Boolean)
      const res = await addOrder({
        customerId: cid,
        deviceType: deviceType === 'Otro' ? titleCase(customDeviceType.trim()) || 'Otro' : deviceType,
        brand,
        model,
        accessories: accList.map((a) => titleCase(a)).join(', '),
        conditions: conditions.map((c) => titleCase(c)).join(', '),
        pin: noPin ? '' : pin.trim(),
        noPin,
        pattern: pattern.length >= 3 ? pattern : null,
        diagnosisType,
        issue: sentenceCase(issue.trim()),
        fix: (diagnosisType === 'visible' ? [...fixes, customFix.trim()].filter(Boolean) : []).map((f) => titleCase(f)).join(', '),
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
            <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Cliente
            </div>

            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 dark:border-primary-500/30 dark:bg-primary-500/10">
                <p className="truncate text-sm font-semibold text-primary-700 dark:text-primary-300">
                  {selectedCustomer.fullName}
                  {selectedCustomer.dni ? <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">· DNI {selectedCustomer.dni}</span> : null}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedCustomerId('')}
                  className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary-200 px-2.5 py-1 text-xs font-semibold text-primary-600 transition hover:bg-primary-100 dark:border-primary-500/30 dark:text-primary-400 dark:hover:bg-primary-500/10"
                >
                  <X size={13} />
                  Quitar
                </button>
              </div>
            ) : (
              <>
                <div className="relative mb-3">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={custQuery}
                    onChange={(e) => setCustQuery(e.target.value)}
                    placeholder="Buscar cliente existente por nombre, DNI o teléfono..."
                    className={`${inputCls} pl-9`}
                  />
                  {customerMatches.length > 0 && (
                    <div className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                      {customerMatches.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(c.id)
                            setCustQuery('')
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-primary-50 dark:text-slate-200 dark:hover:bg-primary-500/10"
                        >
                          <span className="font-semibold">{c.fullName}</span>
                          {c.dni && <span className="ml-1 text-xs text-slate-400">DNI {c.dni}</span>}
                          {c.phone && <span className="ml-2 text-xs text-slate-400">{c.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input type="text" value={newCustomer.fullName} onChange={(e) => setNewCustomer((f) => ({ ...f, fullName: e.target.value }))} placeholder="Nombre completo *" className={inputCls} />
                  <input type="text" inputMode="numeric" value={newCustomer.dni} onChange={(e) => setNewCustomer((f) => ({ ...f, dni: e.target.value }))} placeholder="DNI" className={inputCls} />
                  <input type="tel" value={newCustomer.phone} onChange={(e) => setNewCustomer((f) => ({ ...f, phone: e.target.value }))} placeholder="Teléfono" className={inputCls} />
                  <input type="text" value={newCustomer.address} onChange={(e) => setNewCustomer((f) => ({ ...f, address: e.target.value }))} placeholder="Domicilio" className={inputCls} />
                </div>
              </>
            )}
          </div>

          {/* Dispositivo */}
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Tipo de dispositivo</label>
              <div className="flex items-center gap-2 pt-1">
                {DEVICE_TYPES.map((t) => {
                  const Icon = DEVICE_TYPE_ICONS[t]
                  return (
                    <button
                      key={t}
                      type="button"
                      title={t}
                      onClick={() => {
                        setDeviceType(t)
                        setBrand('')
                        setModel('')
                      }}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-lg border transition ${
                        deviceType === t
                          ? 'border-primary-600 bg-primary-50 text-primary-600 dark:border-primary-400 dark:bg-primary-500/15 dark:text-primary-400'
                          : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Icon size={20} />
                    </button>
                  )
                })}
              </div>
              {deviceType === 'Otro' && (
                <input
                  type="text"
                  value={customDeviceType}
                  onChange={(e) => setCustomDeviceType(e.target.value)}
                  placeholder="Describí el tipo de dispositivo..."
                  className={`${inputCls} mt-2`}
                  autoFocus
                />
              )}
            </div>

            {/* Marca */}
            {deviceType !== 'Otro' && (
            <div>
              <label className={labelCls}>Marca</label>
              {deviceType ? (
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
              ) : (
              <p className="text-sm text-slate-400">Elegí el tipo de dispositivo primero.</p>
              )}
            </div>
            )}

            {/* Modelo */}
            {deviceType !== 'Otro' && (
            <div>
              <label className={labelCls}>Modelo</label>
              {deviceType ? (
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
              ) : (
              <p className="text-sm text-slate-400">Elegí el tipo de dispositivo primero.</p>
              )}
            </div>
            )}

            <div>
              <label className={labelCls}>Estado en que entra el equipo</label>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {conditionOptions.map((c) => (
                  <button key={c} type="button"
                    onClick={() => setConditions((list) => (list.includes(c) ? list.filter((x) => x !== c) : list.length >= 8 ? list : [...list, c]))}
                    className={conditions.includes(c) ? chipSelected : chipIdle}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex flex-col justify-around gap-4">
                <div>
                  <label className={labelCls}>PIN / contraseña del equipo</label>
                  <input type="text" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN o contraseña" disabled={noPin} className={`${inputCls} ${noPin ? 'opacity-50 cursor-not-allowed' : ''}`} />
                  <label className="flex items-center gap-2 mt-1 text-sm text-slate-500 dark:text-slate-400 select-none cursor-pointer">
                    <input type="checkbox" checked={noPin} onChange={(e) => { setNoPin(e.target.checked); if (e.target.checked) setPin('') }} className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                    El cliente no dejó contraseña
                  </label>
                </div>
                <div>
                  <label className={labelCls}>Con accesorios</label>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {accessoryOptions.map((a) => (
                      <button key={a} type="button" onClick={() => toggleAccessory(a)}
                        className={accessories.includes(a) ? chipSelected : chipIdle}>
                        {a}
                      </button>
                    ))}
                    {accessories.filter((a) => !accessoryOptions.includes(a)).map((a) => (
                      <span key={a} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300">
                        {a}
                        <button type="button" onClick={() => toggleAccessory(a)} aria-label={`Quitar ${a}`} className="transition hover:text-red-500">
                          <X size={12} />
                        </button>
                      </span>
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
              <div className="flex flex-col">
                <label className={labelCls}>Patrón de desbloqueo</label>
                <div className="pt-1">
                  <PatternPad key={noPin ? 'nopin' : 'pin'} value={pattern} onChange={setPattern} disabled={noPin} />
                </div>
              </div>
            </div>
          </div>

          {/* Ingreso */}
          <div>
            <label className={labelCls}>Tipo de ingreso</label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setDiagnosisType('visible')}
                className={diagnosisType === 'visible' ? chipSelected : chipIdle}>
                Reparación
              </button>
              <button type="button" onClick={() => setDiagnosisType('revision')}
                className={diagnosisType === 'revision' ? chipSelected : chipIdle}>
                Revisión
              </button>
            </div>
          </div>

            <div>
            <label className={labelCls}>Chequeos / notas generales</label>
            <textarea value={issue} onChange={(e) => setIssue(e.target.value)} maxLength={200} placeholder="Chequeos y notas generales..." className={inputCls} rows={3} />
            <p className="mt-1 text-right text-xs text-slate-400">{issue.length} / 200</p>
          </div>

          {diagnosisType === 'visible' && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Arreglo a realizar</label>
                <div className="flex flex-wrap items-center gap-2">
                  {fixOptions.map((f) => (
                    <button key={f} type="button" onClick={() => toggleFix(f)}
                      className={fixes.includes(f) ? chipSelected : chipIdle}>
                      {f}
                    </button>
                  ))}
                  {fixes.filter((f) => !fixOptions.includes(f)).map((f) => (
                    <span key={f} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300">
                      {f}
                      <button type="button" onClick={() => toggleFix(f)} aria-label={`Quitar ${f}`} className="transition hover:text-red-500">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <span className="flex items-center gap-1">
                    <input type="text" value={customFix} onChange={(e) => setCustomFix(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddCustomFix() } }}
                      placeholder="Otro arreglo..." className={`${inputCls} !w-40`} />
                    <button type="button" onClick={onAddCustomFix} className={chipIdle}>
                      <Plus size={13} />
                    </button>
                  </span>
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