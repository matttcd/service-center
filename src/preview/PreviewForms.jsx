import { Save } from 'lucide-react'
import { PROFILES, date, money } from './system-model.js'

export function Field({ label, children, ...props }) {
  return <label>{label}{children || <input {...props} />}</label>
}
export function FormActions({ onClose, label = 'Guardar' }) {
  return <div className="fp-form-actions"><button type="button" className="fp-button secondary" onClick={onClose}>Cerrar</button><button type="submit" className="fp-button primary"><Save size={15} />{label}</button></div>
}
export function CustomerForm({ value, set, onSubmit, onClose }) {
  return <form className="fp-form" onSubmit={(e) => { e.preventDefault(); onSubmit(value) }}><Field label="Nombre" required value={value.name} onChange={(e) => set({ name: e.target.value })} /><Field label="Teléfono" required value={value.phone} onChange={(e) => set({ phone: e.target.value })} /><Field label="Correo electrónico" type="email" value={value.email} onChange={(e) => set({ email: e.target.value })} /><Field label="Dirección" value={value.address} onChange={(e) => set({ address: e.target.value })} /><FormActions onClose={onClose} /></form>
}
export function UserForm({ value, set, onSubmit, onClose }) {
  return <form className="fp-form" onSubmit={(e) => { e.preventDefault(); onSubmit(value) }}><p className="fp-muted">Cuenta de demostración</p><Field label="Nombre" required value={value.name} onChange={(e) => set({ name: e.target.value })} /><Field label="Perfil"><select value={value.role} onChange={(e) => set({ role: e.target.value })}>{Object.entries(PROFILES).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}</select></Field><label className="fp-checkbox"><input type="checkbox" checked={value.active} onChange={(e) => set({ active: e.target.checked })} />Activo</label><FormActions onClose={onClose} /></form>
}
export function DocumentPreview({ state, order, label, rows }) {
  return <div className="fp-document"><div className="fp-document-stamp">Vista previa ficticia · No imprime ni exporta</div><h2>{state.settings.business}</h2><p>{state.settings.address}</p><p>{state.settings.phone}</p>{order ? <><hr /><h3>{label ? 'Etiqueta' : 'Comprobante'} · {order.number}</h3><p>{order.brand} {order.model}</p><p>{order.customer} · {order.phone}</p>{!label && <><h3>Notas generales</h3><p>{order.issue}</p><h3>Trabajo a realizar</h3><p>{order.work || 'Trabajo por definir'}</p><p>Presupuesto: {money(order.rejectedCharge ?? order.price)} · Seña: {money(order.advance)}</p><p>{state.settings.terms}</p></>}</> : <><hr /><h3>Listado de órdenes · {rows.length}</h3>{rows.map((o) => <p key={o.id}>{o.number} · {o.brand} {o.model} · {o.customer}</p>)}</>}<p className="fp-muted">{date(Date.now())}</p></div>
}
export function AccountForm({ type, role, onClose, onSubmit }) {
  return <form className="fp-form" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); if (type === 'password' && data.get('new') !== data.get('repeat')) { e.currentTarget.elements.repeat.setCustomValidity('Las contraseñas no coinciden.'); e.currentTarget.elements.repeat.reportValidity(); return } onSubmit() }}><p className="fp-muted">Simulación · Usá datos ficticios</p>{type === 'password' ? <><Field label="Contraseña nueva (ficticia)" name="new" type="password" autoComplete="off" required minLength={8} /><Field label="Repetir contraseña" name="repeat" type="password" autoComplete="off" required minLength={8} onChange={(e) => e.target.setCustomValidity('')} /></> : <><Field label="Nombre" defaultValue={PROFILES[role].name} required /><Field label="Perfil" value={PROFILES[role].label} readOnly /></>}<FormActions onClose={onClose} /></form>
}
