import { intakeError, customerMatchesQuery, deviceModels } from '../../shared/intake.js'
import WorkPicker from './WorkPicker.jsx'
import { formatDni, normalizeDni } from '../utils/helpers.js'
import { useFormDraft } from '../utils/useFormDraft.js'
import { useOrderDraft } from '../context/workspace.js'
// ============================================
// OrderForm: alta de una orden de servicio (un solo dispositivo)
// Marcas/modelos con badges del catálogo + "otro" (búsqueda y alta en BD).
// ============================================
import { useNotify } from '../context/notifications.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, ListPlus, X, Smartphone, Tablet, Laptop, Monitor, Gamepad2, Printer, HelpCircle } from 'lucide-react'
import Modal from './Modal.jsx'
import PatternPad from './PatternPad.jsx'
import { useData } from '../context/DataContext.jsx'
import { titleCase, sentenceCase, uid } from '../utils/helpers.js'
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
  const { customers, catalog, addCustomer, updateCustomer, addOrder, addCatalogBrand, addCatalogModel, catalogLists } = useData()
  const [orderDraft, patchOrderDraft] = useOrderDraft('new-order')
  const [requestId, setRequestId] = useState(() => orderDraft.requestId || uid())
  const [fields, patchFields, clearFields] = useFormDraft({ custQuery: '', selectedCustomerId: '', newCustomer: { fullName: '', dni: '', phone: '', phone2: '', phone3: '', address: '' }, brand: '', model: '', deviceType: '', customDeviceType: '', accessories: [], customAccessory: '', conditions: [], noContact: false, pin: '', noPin: false, pattern: [], diagnosisType: 'visible', isSimpleService: false, isExternal: false, issue: '', fixes: [], customFix: '', price: '', advance: '0' }, orderDraft.values, (values) => patchOrderDraft({ values, requestId: values ? requestId : undefined }))
  const { custQuery, selectedCustomerId, newCustomer, brand, model, deviceType, customDeviceType, accessories, customAccessory, conditions, noContact, pin, noPin, pattern, diagnosisType, isSimpleService, isExternal, issue, fixes, customFix, price, advance } = fields
  const setCustQuery = (value) => patchFields({ custQuery: typeof value === 'function' ? value(fields.custQuery) : value })
  const setSelectedCustomerId = (value) => patchFields({ selectedCustomerId: typeof value === 'function' ? value(fields.selectedCustomerId) : value })
  const setNewCustomer = (value) => patchFields({ newCustomer: typeof value === 'function' ? value(fields.newCustomer) : value })
  const setBrand = (value) => patchFields({ brand: typeof value === 'function' ? value(fields.brand) : value })
  const setModel = (value) => patchFields({ model: typeof value === 'function' ? value(fields.model) : value })
  const setDeviceType = (value) => patchFields({ deviceType: typeof value === 'function' ? value(fields.deviceType) : value })
  const setCustomDeviceType = (value) => patchFields({ customDeviceType: typeof value === 'function' ? value(fields.customDeviceType) : value })
  const setAccessories = (value) => patchFields({ accessories: typeof value === 'function' ? value(fields.accessories) : value })
  const setCustomAccessory = (value) => patchFields({ customAccessory: typeof value === 'function' ? value(fields.customAccessory) : value })
  const setConditions = (value) => patchFields({ conditions: typeof value === 'function' ? value(fields.conditions) : value })
  const setPin = (value) => patchFields({ pin: typeof value === 'function' ? value(fields.pin) : value })
  const setNoPin = (value) => patchFields({ noPin: typeof value === 'function' ? value(fields.noPin) : value })
  const setPattern = (value) => patchFields({ pattern: typeof value === 'function' ? value(fields.pattern) : value })
  const setDiagnosisType = (value) => patchFields({ diagnosisType: typeof value === 'function' ? value(fields.diagnosisType) : value })
  const setIsSimpleService = (value) => patchFields({ isSimpleService: typeof value === 'function' ? value(fields.isSimpleService) : value })
  const setIsExternal = (value) => patchFields({ isExternal: typeof value === 'function' ? value(fields.isExternal) : value })
  const setIssue = (value) => patchFields({ issue: typeof value === 'function' ? value(fields.issue) : value })
  const setFixes = (value) => patchFields({ fixes: typeof value === 'function' ? value(fields.fixes) : value })
  const setCustomFix = (value) => patchFields({ customFix: typeof value === 'function' ? value(fields.customFix) : value })
  const setPrice = (value) => patchFields({ price: typeof value === 'function' ? value(fields.price) : value })
  const setAdvance = (value) => patchFields({ advance: typeof value === 'function' ? value(fields.advance) : value })
  const savingRef = useRef(false)
  const [customerSearch, setCustomerSearch] = useState(false)
  const [phoneCount, setPhoneCount] = useState(1)
  const inform = useNotify('info')
  const [picker, setPicker] = useState(null) // null | 'brand' | 'model'
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerNew, setPickerNew] = useState('')
  const setError = useNotify('error')
  const [saving, setSaving] = useState(false)
  const [filteredCatalog, setFilteredCatalog] = useState(null)

  const accessoryOptions = catalogLists?.accessories?.length ? catalogLists.accessories : ACCESSORY_FALLBACK
  const conditionOptions = catalogLists?.conditions?.length ? catalogLists.conditions : CONDITION_FALLBACK
  const fixOptions = catalogLists?.fixes?.length ? catalogLists.fixes : FIX_FALLBACK

  useEffect(() => {
    if (!open) return
    setError('')
  }, [open, setError])

  // Fetch de marcas y modelos cuando cambia el tipo de dispositivo.
  useEffect(() => {
    if (!open || !deviceType || deviceType === 'Otro') {
      setFilteredCatalog(null)
      return
    }
    let cancelled = false
    api(`/catalog?deviceType=${encodeURIComponent(deviceType)}`).then((res) => {
      if (cancelled) return
      if (res && res.brands) setFilteredCatalog({ deviceType, brands: res.brands, models: res.models || [] })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [open, deviceType])

  // Badges de marcas y modelos según el catálogo (ordenado por uso).
  const filteredBrands = useMemo(() => {
    if (filteredCatalog?.deviceType === deviceType) return filteredCatalog.brands
    return catalog.brands || []
  }, [catalog.brands, filteredCatalog, deviceType])
  const topBrands = useMemo(() => filteredBrands.slice(0, BRAND_BADGE_COUNT), [filteredBrands])
  const brandModels = useMemo(
    () => {
      const models = filteredCatalog?.deviceType === deviceType ? filteredCatalog.models : (catalog.models || [])
      return deviceModels(models, brand, deviceType).slice(0, MODEL_BADGE_COUNT)
    },
    [catalog.models, brand, filteredCatalog, deviceType],
  )
  const allBrandModels = useMemo(
    () => {
      const models = filteredCatalog?.deviceType === deviceType ? filteredCatalog.models : (catalog.models || [])
      return deviceModels(models, brand, deviceType)
    },
    [catalog.models, brand, filteredCatalog, deviceType],
  )

  const pickerList = picker === 'brand' ? filteredBrands : allBrandModels
  const pickerFiltered = pickerList.filter((x) =>
    x.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()),
  )

  const customerMatches = useMemo(() => customers.filter((c) => customerMatchesQuery(c, custQuery)).slice(0, 30), [customers, custQuery])
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null
  const chooseCustomer = (customer) => {
    patchFields({ selectedCustomerId: customer.id, custQuery: '', newCustomer: { fullName: customer.fullName, dni: customer.dni || '', address: customer.address || '', phone: customer.phone || '', phone2: customer.phone2 || '', phone3: customer.phone3 || '' } })
    setPhoneCount(customer.phone3 ? 3 : customer.phone2 ? 2 : 1)
    setCustomerSearch(false)
  }
  const loadDniCustomer = () => {
    const dni = normalizeDni(newCustomer.dni)
    const existing = customers.find((c) => dni && normalizeDni(c.dni) === dni && c.id !== selectedCustomerId)
    if (existing) { chooseCustomer(existing); inform('Cliente cargado por DNI.') }
  }

  const requestClose = () => { if (!saving) onClose() }

  const toggleAccessory = (name) =>
    setAccessories((list) => {
      if (list.includes(name)) return list.filter((a) => a !== name)
      if (name === 'Sin accesorios') return [name]
      if (list.length >= 10) return list
      return [...list.filter((a) => a !== 'Sin accesorios'), name]
    })

  const addCustomAccessory = () => {
    const v = customAccessory.trim()
    if (!v) return
    setAccessories((list) => (list.includes(v) || list.length >= 10 ? list : [...list.filter((a) => a !== 'Sin accesorios'), v]))
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
      const res = await addCatalogModel(brand, v, deviceType === 'Otro' ? customDeviceType.trim() || 'Otro' : deviceType)
      if (res.error) return setError(res.error)
      addFromPicker(res.model.name)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (savingRef.current) return
    const accList = [...accessories, customAccessory.trim()].filter(Boolean)
    const data = {
      deviceType: deviceType === 'Otro' ? titleCase(customDeviceType.trim()) : deviceType,
      brand, model,
      accessories: accList.map(titleCase).join(', '),
      conditions: conditions.map(titleCase).join(', '),
      pin: noPin ? '' : pin.trim(), noPin, noContact,
      pattern: noPin ? null : pattern.length >= 3 ? pattern : null,
      diagnosisType, isSimpleService, isExternal,
      issue: sentenceCase(issue.trim()),
      fix: (diagnosisType === 'visible' ? [...fixes, customFix.trim()].filter(Boolean) : []).map(titleCase).join(', '),
      price: Number(price) || 0, advance: Number(advance) || 0,
    }
    const existing = customers.find((c) => normalizeDni(c.dni) && normalizeDni(c.dni) === normalizeDni(newCustomer.dni) && c.id !== selectedCustomerId)
    if (existing) { chooseCustomer(existing); return inform('Cliente cargado por DNI. Revisá sus datos antes de guardar.') }
    const error = intakeError(data, newCustomer)
    if (error) return setError(error)
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      let cid = selectedCustomerId
      const customerFields = { ...newCustomer, fullName: titleCase(newCustomer.fullName), address: titleCase(newCustomer.address), dni: normalizeDni(newCustomer.dni), email: selectedCustomer?.email || '' }
      if (!cid) {
        const result = await addCustomer({ ...customerFields, reuseExisting: true })
        if (result.error) throw new Error(result.error)
        cid = result.id
        if (result.reused && result.customer) {
          chooseCustomer(result.customer)
          return inform('Cliente cargado por DNI. Revisá sus datos antes de guardar.')
        }
        setSelectedCustomerId(cid)
      } else if (Object.entries(customerFields).some(([key, value]) => (selectedCustomer?.[key] || '') !== value)) {
        const result = await updateCustomer(cid, customerFields)
        if (result.error) throw new Error(result.error)
      }
      const res = await addOrder({ requestId, customerId: cid, ...data })
      if (res.error) throw new Error(res.error)
      clearFields()
      setRequestId(uid())
      onClose()
      onCreated(res.order)
    } catch (err) {
      setError(err.message)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
  const labelCls = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300'

  return (
    <Modal open={open} onClose={requestClose} title="Nueva orden de servicio" maxWidth="max-w-3xl">
        <form noValidate onSubmit={handleSubmit} className="space-y-5">

          {/* Cliente */}
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Cliente
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-500">{selectedCustomer ? `Cliente: ${selectedCustomer.fullName}` : 'Nuevo cliente'}</p>
              <button type="button" className="ws-button" onClick={() => setCustomerSearch(true)}><Search size={16} />Buscar cliente</button>
              {selectedCustomer && <button type="button" className="ws-button" onClick={() => { patchFields({ selectedCustomerId: '', newCustomer: { fullName: '', dni: '', phone: '', phone2: '', phone3: '', address: '' } }); setPhoneCount(1) }}>Nuevo cliente</button>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelCls}>Nombre completo *<input required type="text" value={newCustomer.fullName} onChange={(e) => setNewCustomer((f) => ({ ...f, fullName: e.target.value }))} placeholder="Nombre completo *" className={inputCls} /></label>
              <label className={labelCls}>DNI *<input required type="text" inputMode="numeric" value={formatDni(newCustomer.dni)} onBlur={loadDniCustomer} onChange={(e) => { const dni = normalizeDni(e.target.value); patchFields({ newCustomer: { ...newCustomer, dni }, ...(selectedCustomer && dni !== normalizeDni(selectedCustomer.dni) ? { selectedCustomerId: '' } : {}) }) }} placeholder="DNI" className={inputCls} /></label>
              <label className={labelCls}>Domicilio *<input required type="text" value={newCustomer.address} onChange={(e) => setNewCustomer((f) => ({ ...f, address: e.target.value }))} placeholder="Domicilio" className={inputCls} /></label>
              {['phone', 'phone2', 'phone3'].slice(0, Math.max(phoneCount, newCustomer.phone3 ? 3 : newCustomer.phone2 ? 2 : 1)).map((key, index) => <label key={key} className={labelCls}>{index ? `Teléfono ${index + 1}` : 'Teléfono (opcional)'}<input type="tel" value={newCustomer[key] || ''} onChange={(e) => setNewCustomer((f) => ({ ...f, [key]: e.target.value }))} placeholder={index ? `Teléfono ${index + 1}` : 'Teléfono'} className={inputCls} /></label>)}
            </div>
            {Math.max(phoneCount, newCustomer.phone3 ? 3 : newCustomer.phone2 ? 2 : 1) < 3 && <button type="button" className="ws-button mt-2" onClick={() => setPhoneCount(Math.max(phoneCount, newCustomer.phone2 ? 2 : 1) + 1)}><Plus size={15} />Agregar teléfono</button>}
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={noContact} onChange={(e) => patchFields({ noContact: e.target.checked })} />Sin medio de comunicación · confirma en el local</label>
          </div>

          {/* Dispositivo */}
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Tipo de dispositivo *</label>
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
              <label className={labelCls}>Marca *</label>
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
            {deviceType === 'Otro' && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={labelCls}>Marca *</label><input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Marca (o Sin marca)" className={inputCls} /></div>
              <div><label className={labelCls}>Modelo *</label><input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Modelo o identificación del equipo" className={inputCls} /></div>
            </div>}
            {deviceType !== 'Otro' && (
            <div>
              <label className={labelCls}>Modelo *</label>
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
              <label className={labelCls}>Estado en que entra el equipo *</label>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[...new Set([...conditionOptions, 'Sin observaciones'])].map((c) => (
                  <button key={c} type="button"
                    onClick={() => setConditions((list) => (list.includes(c) ? list.filter((x) => x !== c) : c === 'Sin observaciones' ? [c] : list.length >= 8 ? list : [...list.filter((x) => x !== 'Sin observaciones'), c]))}
                    className={conditions.includes(c) ? chipSelected : chipIdle}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex flex-col justify-around gap-4">
                <div>
                  <label className={labelCls}>PIN / contraseña del equipo *</label>
                  <input type="text" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN o contraseña" disabled={noPin} className={`${inputCls} ${noPin ? 'opacity-50 cursor-not-allowed' : ''}`} />
                  <label className="flex items-center gap-2 mt-1 text-sm text-slate-500 dark:text-slate-400 select-none cursor-pointer">
                    <input type="checkbox" checked={noPin} onChange={(e) => { setNoPin(e.target.checked); if (e.target.checked) { setPin(''); setPattern([]) } }} className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                    El cliente no dejó contraseña
                  </label>
                </div>
                <div>
                  <label className={labelCls}>Con accesorios *</label>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {[...new Set([...accessoryOptions, 'Sin accesorios'])].map((a) => (
                      <button key={a} type="button" onClick={() => toggleAccessory(a)}
                        className={accessories.includes(a) ? chipSelected : chipIdle}>
                        {a}
                      </button>
                    ))}
                    {accessories.filter((a) => !accessoryOptions.includes(a) && a !== 'Sin accesorios').map((a) => (
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
            <label className={labelCls}>Tipo de ingreso *</label>
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
            <label className="mt-2 flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={isSimpleService} onChange={(e) => setIsSimpleService(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
              Servicio simple
            </label>
            <label className="mt-2 flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={isExternal} onChange={(e) => setIsExternal(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500" />
              Enviar a técnico externo
            </label>
          </div>

            <div>
            <label className={labelCls}>Chequeos / notas generales *</label>
            <textarea value={issue} onChange={(e) => setIssue(e.target.value)} maxLength={200} placeholder="Chequeos y notas generales..." className={inputCls} rows={3} />
            <p className="mt-1 text-right text-xs text-slate-400">{issue.length} / 200</p>
          </div>

          {diagnosisType === 'visible' && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Arreglo a realizar *</label>
                <WorkPicker options={fixOptions} selected={fixes} onChange={setFixes} custom={customFix} onCustomChange={setCustomFix} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Presupuesto ($) *</label>
                  <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Costo del arreglo" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Seña ($) *</label>
                  <input type="number" min="0" step="0.01" value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="0" className={inputCls} />
                </div>
              </div>
            </div>
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

          <Modal open={customerSearch} onClose={() => setCustomerSearch(false)} title="Buscar cliente">
            <div className="space-y-3">
              <label className={labelCls}>Nombre, DNI o teléfono<input autoFocus value={custQuery} onChange={(e) => setCustQuery(e.target.value)} placeholder="Buscar cliente" className={inputCls} /></label>
              <div className="max-h-64 space-y-1 overflow-y-auto pr-2">
                {customerMatches.map((customer) => <button type="button" key={customer.id} className="block w-full rounded-lg p-3 text-left text-sm hover:bg-primary-50 dark:hover:bg-slate-700" onClick={() => chooseCustomer(customer)}><strong>{customer.fullName}</strong><p>DNI {formatDni(customer.dni) || '—'} · {[customer.phone, customer.phone2, customer.phone3].filter(Boolean).join(' · ') || 'Sin teléfono'}</p></button>)}
                {custQuery.trim() && !customerMatches.length && <p className="text-sm text-slate-500">Sin resultados</p>}
              </div>
            </div>
          </Modal>

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
    </Modal>
  )
}
