import { Save } from 'lucide-react'
import PatternPad from '../components/PatternPad.jsx'
import { PROFILES, date, money } from './system-model.js'

export function Field({ label, children, ...props }) {
  return <label>{label}{children || <input {...props} />}</label>
}
export function FormActions({ onClose, label = 'Guardar' }) {
  return <div className="fp-form-actions"><button type="button" className="fp-button secondary" onClick={onClose}>Cerrar</button><button type="submit" className="fp-button primary"><Save size={15} />{label}</button></div>
}
export function NewOrderForm({ state, value, set, onSubmit, onClose }) {
  const repair = value.entry === 'repair' || value.isSimpleService
  return <form className="fp-form" onSubmit={(e) => { e.preventDefault(); onSubmit(value) }}>
    <div className="fp-form-grid"><Field label="Cliente"><select value={value.customerId} onChange={(e) => set({ customerId: e.target.value })}><option value="">Nuevo cliente</option>{state.customers.filter((c) => !c.deletedAt).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      {!value.customerId && <><Field label="Nombre del cliente" required value={value.customer} onChange={(e) => set({ customer: e.target.value })} /><Field label="Teléfono" required value={value.phone} onChange={(e) => set({ phone: e.target.value })} /></>}
    </div>
    <h3>Equipo</h3><div className="fp-form-grid"><Field label="Tipo"><select value={value.deviceType} onChange={(e) => set({ deviceType: e.target.value })}>{['Celular', 'Notebook', 'Monitor', 'Consola', 'Otro'].map((s) => <option key={s}>{s}</option>)}</select></Field><Field label="Marca" required value={value.brand} onChange={(e) => set({ brand: e.target.value })} /><Field label="Modelo" list="preview-catalog" required value={value.model} onChange={(e) => set({ model: e.target.value })} /><datalist id="preview-catalog">{state.settings.catalog.map((s) => <option key={s}>{s}</option>)}</datalist></div>
    <Field label="Falla informada"><textarea required rows={2} value={value.issue} onChange={(e) => set({ issue: e.target.value })} /></Field>
    <div className="fp-form-grid"><Field label="Contraseña o PIN" disabled={value.noPin} value={value.access} onChange={(e) => set({ access: e.target.value })} /><label className="fp-checkbox"><input type="checkbox" checked={value.noPin} onChange={(e) => set({ noPin: e.target.checked })} />Sin bloqueo</label></div>
    <details className="fp-form-pattern"><summary>Registrar patrón</summary><PatternPad value={value.pattern} disabled={value.noPin} onChange={(pattern) => set({ pattern })} /></details>
    <div className="fp-form-grid"><Field label="Estado físico"><textarea value={value.conditions} onChange={(e) => set({ conditions: e.target.value })} placeholder={state.settings.conditions.split('\n')[0]} /></Field><Field label="Accesorios"><textarea value={value.accessories} onChange={(e) => set({ accessories: e.target.value })} placeholder="Sin accesorios" /></Field></div>
    <h3>Ingreso</h3><Field label="Tipo de ingreso"><select value={value.entry} onChange={(e) => set({ entry: e.target.value })}><option value="review">Para revisión</option><option value="repair">Reparación definida</option></select></Field>
    <label className="fp-checkbox"><input type="checkbox" checked={value.isSimpleService} onChange={(e) => set({ isSimpleService: e.target.checked })} />Servicio simple</label>
    <label className="fp-checkbox"><input type="checkbox" checked={value.isExternal} onChange={(e) => set({ isExternal: e.target.checked, externalTech: value.externalTech || state.settings.externals.split('\n')[0] })} />Enviar a técnico externo</label>
    {value.isExternal && <Field label="Técnico externo"><select value={value.externalTech} onChange={(e) => set({ externalTech: e.target.value })}>{state.settings.externals.split('\n').filter(Boolean).map((s) => <option key={s}>{s}</option>)}</select></Field>}
    {repair && <><Field label="Trabajo a realizar"><textarea required value={value.work} onChange={(e) => set({ work: e.target.value })} /></Field><div className="fp-form-grid"><Field label="Presupuesto" type="number" required min="1" step="0.01" value={value.price} onChange={(e) => set({ price: e.target.value })} /><Field label="Seña" type="number" min="0" step="0.01" value={value.advance} onChange={(e) => set({ advance: e.target.value })} /></div><label className="fp-checkbox"><input type="checkbox" checked={value.confirmed} onChange={(e) => set({ confirmed: e.target.checked })} />Presupuesto aprobado</label></>}
    <FormActions onClose={onClose} label="Crear orden" />
  </form>
}
export function CustomerForm({ value, set, onSubmit, onClose }) {
  return <form className="fp-form" onSubmit={(e) => { e.preventDefault(); onSubmit(value) }}><Field label="Nombre" required value={value.name} onChange={(e) => set({ name: e.target.value })} /><Field label="Teléfono" required value={value.phone} onChange={(e) => set({ phone: e.target.value })} /><Field label="Correo electrónico" type="email" value={value.email} onChange={(e) => set({ email: e.target.value })} /><Field label="Dirección" value={value.address} onChange={(e) => set({ address: e.target.value })} /><FormActions onClose={onClose} /></form>
}
export function UserForm({ value, set, onSubmit, onClose }) {
  return <form className="fp-form" onSubmit={(e) => { e.preventDefault(); onSubmit(value) }}><p className="fp-muted">Cuenta de demostración</p><Field label="Nombre" required value={value.name} onChange={(e) => set({ name: e.target.value })} /><Field label="Perfil"><select value={value.role} onChange={(e) => set({ role: e.target.value })}>{Object.entries(PROFILES).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}</select></Field><label className="fp-checkbox"><input type="checkbox" checked={value.active} onChange={(e) => set({ active: e.target.checked })} />Activo</label><FormActions onClose={onClose} /></form>
}
export function DocumentPreview({ state, order, label, rows }) {
  return <div className="fp-document"><div className="fp-document-stamp">Vista previa ficticia · No imprime ni exporta</div><h2>{state.settings.business}</h2><p>{state.settings.address}</p><p>{state.settings.phone}</p>{order ? <><hr /><h3>{label ? 'Etiqueta' : 'Comprobante'} · {order.number}</h3><p>{order.brand} {order.model}</p><p>{order.customer} · {order.phone}</p>{!label && <><h3>Falla informada</h3><p>{order.issue}</p><h3>Trabajo a realizar</h3><p>{order.work || 'Trabajo por definir'}</p><p>Presupuesto: {money(order.rejectedCharge ?? order.price)} · Seña: {money(order.advance)}</p><p>{state.settings.terms}</p></>}</> : <><hr /><h3>Listado de órdenes · {rows.length}</h3>{rows.map((o) => <p key={o.id}>{o.number} · {o.brand} {o.model} · {o.customer}</p>)}</>}<p className="fp-muted">{date(Date.now())}</p></div>
}
export function AccountForm({ type, role, onClose, onSubmit }) {
  return <form className="fp-form" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); if (type === 'password' && data.get('new') !== data.get('repeat')) { e.currentTarget.elements.repeat.setCustomValidity('Las contraseñas no coinciden.'); e.currentTarget.elements.repeat.reportValidity(); return } onSubmit() }}><p className="fp-muted">Simulación · Usá datos ficticios</p>{type === 'password' ? <><Field label="Contraseña nueva (ficticia)" name="new" type="password" autoComplete="off" required minLength={8} /><Field label="Repetir contraseña" name="repeat" type="password" autoComplete="off" required minLength={8} onChange={(e) => e.target.setCustomValidity('')} /></> : <><Field label="Nombre" defaultValue={PROFILES[role].name} required /><Field label="Perfil" value={PROFILES[role].label} readOnly /></>}<FormActions onClose={onClose} /></form>
}
