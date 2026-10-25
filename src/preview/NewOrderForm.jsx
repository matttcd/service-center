import { useRef, useState } from 'react'
import { Check, ListPlus, Plus, Search, X } from 'lucide-react'
import PatternPad from '../components/PatternPad.jsx'
import { DEVICE_TYPES } from '../../shared/fsm.js'
import { BRAND_BADGE_COUNT, MODEL_BADGE_COUNT } from '../utils/constants.js'
import { DeviceIcon } from './OrderWorkspace.jsx'
import { Field, FormActions } from './PreviewForms.jsx'
import { intakeChoices, intakeSuggestions, toggleIntakeChoice } from './intake-model.js'

function IntakeChips({ label, options, value, onChange, custom = '', onCustomChange, limit }) {
  const inputRef = useRef(null)
  const selected = intakeChoices(value), choices = [...new Set([...options, ...selected])]
  const add = () => {
    const name = custom.trim()
    if (!name || (selected.length >= limit && !selected.includes(name))) return
    if (!selected.includes(name)) onChange([...selected, name].join(', '))
    onCustomChange('')
    inputRef.current?.focus()
  }
  return <fieldset className="fp-intake-field"><legend>{label}</legend><div className="fp-intake-chips" role="group" aria-label={label}>
    {choices.map((name) => <button type="button" key={name} aria-pressed={selected.includes(name)} disabled={!selected.includes(name) && selected.length >= limit} onClick={() => onChange(toggleIntakeChoice(value, name, limit))}>{selected.includes(name) && <Check size={14} />}{name}</button>)}
  </div><div className="fp-intake-custom"><input ref={inputRef} aria-label={`Otra opción de ${label.toLowerCase()}`} placeholder="Otra opción…" value={custom} onChange={(event) => onCustomChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add() } }} /><button type="button" className="fp-button secondary" aria-label={`Agregar opción de ${label.toLowerCase()}`} disabled={!custom.trim() || selected.length >= limit} onClick={add}><Plus size={16} /></button></div></fieldset>
}

export default function NewOrderForm({ state, value, set, onSubmit, onClose }) {
  const [picker, setPicker] = useState(null)
  const pickerTrigger = useRef(null)
  const repair = value.entry === 'repair' || value.isSimpleService
  const customer = state.customers.find((item) => item.id === value.customerId && !item.deletedAt)
  const query = (value.customerQuery || '').trim().toLocaleLowerCase('es')
  const matches = query ? state.customers.filter((item) => !item.deletedAt && [item.name, item.dni, item.phone].some((text) => text?.toLocaleLowerCase('es').includes(query))).slice(0, 8) : []
  const suggestions = intakeSuggestions(state, value.deviceType, value.brand)
  const brands = suggestions.brands.slice(0, BRAND_BADGE_COUNT), models = suggestions.models.slice(0, MODEL_BADGE_COUNT)
  const options = (key) => state.settings[key].split('\n').map((text) => text.trim()).filter(Boolean)
  const choose = (key, name) => { pickerTrigger.current?.focus(); set({ [key]: name, ...(key === 'brand' ? { model: '' } : {}), pickerQuery: '' }); setPicker(null) }
  const openPicker = (key) => { setPicker(picker === key ? null : key); set({ pickerQuery: '' }) }
  const pickerPanel = (key) => picker === key && <div className="fp-intake-picker" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); pickerTrigger.current?.focus(); setPicker(null) } }}>
    <div className="fp-intake-search"><Search size={16} /><input aria-label={key === 'brand' ? 'Buscar marca' : 'Buscar modelo'} autoFocus placeholder="Buscar o agregar…" value={value.pickerQuery || ''} onChange={(event) => set({ pickerQuery: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (value.pickerQuery?.trim()) choose(key, value.pickerQuery.trim()) } }} /></div>
    <div className="fp-intake-picker-list" role="group" aria-label={key === 'brand' ? 'Marcas disponibles' : 'Modelos disponibles'}>{suggestions[key === 'brand' ? 'brands' : 'models'].filter((item) => item.name.toLocaleLowerCase('es').includes((value.pickerQuery || '').trim().toLocaleLowerCase('es'))).map((item) => <button type="button" key={item.name} onClick={() => choose(key, item.name)}>{item.name}</button>)}</div>
    {value.pickerQuery?.trim() && <button type="button" className="fp-link" onClick={() => choose(key, value.pickerQuery.trim())}><Plus size={15} />Usar «{value.pickerQuery.trim()}»</button>}
  </div>
  const chips = (key, label, limit, customKey) => <IntakeChips label={label} options={options(key === 'work' ? 'fixes' : key)} value={value[key]} onChange={(text) => set({ [key]: text })} custom={value[customKey]} onCustomChange={(text) => set({ [customKey]: text })} limit={limit} />
  return <form className="fp-form fp-intake-form" onSubmit={(event) => { event.preventDefault(); onSubmit(value) }}>
    <section className="fp-intake-section"><h3>Cliente</h3>
      {customer ? <div className="fp-intake-customer"><div><strong>{customer.name}</strong><p>{[customer.dni && `DNI ${customer.dni}`, customer.phone].filter(Boolean).join(' · ')}</p></div><button type="button" className="fp-button secondary" onClick={() => set({ customerId: '', customerQuery: '' })}><X size={14} />Cambiar</button></div> : <>
        <div className="fp-intake-search"><Search size={16} /><input data-initial-focus aria-label="Buscar cliente" placeholder="Buscar por nombre, DNI o teléfono…" value={value.customerQuery || ''} onChange={(event) => set({ customerQuery: event.target.value })} /></div>
        {matches.length > 0 && <div className="fp-intake-customers" role="group" aria-label="Clientes encontrados">{matches.map((item) => <button type="button" key={item.id} onClick={() => set({ customerId: item.id, customerQuery: '' })}><span>{item.name}</span><span>{[item.dni && `DNI ${item.dni}`, item.phone].filter(Boolean).join(' · ')}</span></button>)}</div>}
        <div className="fp-form-grid"><Field label="Nombre completo" required value={value.customer} onChange={(event) => set({ customer: event.target.value })} /><Field label="DNI" inputMode="numeric" value={value.dni || ''} onChange={(event) => set({ dni: event.target.value })} /><Field label="Teléfono" type="tel" required value={value.phone} onChange={(event) => set({ phone: event.target.value })} /><Field label="Domicilio" value={value.address || ''} onChange={(event) => set({ address: event.target.value })} /></div>
      </>}
    </section>
    <section className="fp-intake-section"><fieldset className="fp-intake-field"><legend>Tipo de dispositivo</legend><div className="fp-intake-types" role="group" aria-label="Tipo de dispositivo">{DEVICE_TYPES.map((type) => <button type="button" key={type} aria-pressed={value.deviceType === type} onClick={() => { set({ deviceType: type, brand: '', model: '', pickerQuery: '' }); setPicker(null) }}><DeviceIcon type={type} size={20} /><span>{type}</span></button>)}</div></fieldset>
      {value.deviceType === 'Otro' && <Field label="Tipo de equipo" value={value.customDeviceType || ''} placeholder="Describí el equipo" onChange={(event) => set({ customDeviceType: event.target.value })} />}
      {['brand', 'model'].map((key) => <fieldset className="fp-intake-field" key={key}><legend>{key === 'brand' ? 'Marca' : 'Modelo'}</legend><div className="fp-intake-chips" role="group" aria-label={key === 'brand' ? 'Marcas frecuentes' : 'Modelos frecuentes'}>
        {(key === 'brand' ? brands : models).map((item) => <button type="button" key={item.name} aria-pressed={value[key] === item.name} onClick={() => choose(key, item.name)}>{value[key] === item.name && <Check size={14} />}{item.name}</button>)}
        {value[key] && !(key === 'brand' ? brands : models).some((item) => item.name === value[key]) && <button type="button" aria-pressed="true" onClick={() => set({ [key]: '', ...(key === 'brand' ? { model: '' } : {}) })}>{value[key]}<X size={13} /></button>}
        <button type="button" className="fp-intake-other" ref={picker === key ? pickerTrigger : undefined} disabled={key === 'model' && !value.brand} aria-expanded={picker === key} onClick={() => openPicker(key)}><ListPlus size={15} />{key === 'brand' ? 'Otra marca' : 'Otro modelo'}</button>
      </div>{pickerPanel(key)}</fieldset>)}
      {chips('conditions', 'Estado del equipo', 8, 'customCondition')}
      <div className="fp-intake-access">
        <div>{chips('accessories', 'Accesorios', 10, 'customAccessory')}</div>
        <div><Field label="Contraseña o PIN" disabled={value.noPin} value={value.access} onChange={(event) => set({ access: event.target.value })} /><label className="fp-checkbox"><input type="checkbox" checked={value.noPin} onChange={(event) => set({ noPin: event.target.checked })} />Sin bloqueo</label><div><p className="fp-intake-label">Patrón de desbloqueo</p><PatternPad value={value.pattern} disabled={value.noPin} onChange={(pattern) => set({ pattern })} /></div></div>
      </div>
    </section>
    <section className="fp-intake-section"><fieldset className="fp-intake-field"><legend>Tipo de ingreso</legend><div className="fp-intake-chips" role="group" aria-label="Tipo de ingreso">{[['repair', 'Reparación'], ['review', 'Revisión']].map(([key, label]) => <button type="button" key={key} aria-pressed={value.entry === key} onClick={() => set({ entry: key })}>{label}</button>)}</div></fieldset>
      <div className="fp-intake-flags"><label className="fp-checkbox"><input type="checkbox" checked={value.isSimpleService} onChange={(event) => set({ isSimpleService: event.target.checked })} />Servicio simple</label><label className="fp-checkbox"><input type="checkbox" checked={value.isExternal} onChange={(event) => set({ isExternal: event.target.checked, externalTech: value.externalTech || options('externals')[0] })} />Enviar a técnico externo</label></div>
      {value.isExternal && <Field label="Técnico externo"><select value={value.externalTech} onChange={(event) => set({ externalTech: event.target.value })}>{options('externals').map((name) => <option key={name}>{name}</option>)}</select></Field>}
      <Field label="Notas generales"><textarea required rows={3} value={value.issue} onChange={(event) => set({ issue: event.target.value })} /></Field>
      {repair && <>{chips('work', 'Trabajo a realizar', 8, 'customFix')}<div className="fp-form-grid"><Field label="Presupuesto" type="number" required min="1" step="0.01" value={value.price} onChange={(event) => set({ price: event.target.value })} /><Field label="Seña" type="number" min="0" step="0.01" value={value.advance} onChange={(event) => set({ advance: event.target.value })} /></div></>}
    </section>
    <FormActions onClose={onClose} label="Crear orden" />
  </form>
}
