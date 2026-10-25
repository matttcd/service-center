import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Archive, ArrowLeft, ChevronRight, ClipboardList, Calculator, Bell, MessageSquare, Package, PackageCheck, Truck, DatabaseBackup, FlaskConical, Inbox, LayoutDashboard, LogIn, Menu, Moon, Plus, RotateCcw, Settings, Shield, Sun, Trash2, TrendingUp, Users, Wrench, X } from 'lucide-react'
import { useNotify } from '../context/notifications.js'
import logo from '../assets/gringologo-modified.png'
import ProfileMenu from './ProfileMenu.jsx'
import ReceptionWorkspace from './ReceptionWorkspace.jsx'
import { RECEPTION_DRAFT } from './reception-task.js'
import OrderWorkspace, { DeviceIcon, Status, ToolWindow } from './OrderWorkspace.jsx'
import { TECH_VIEWS, RECEPTION_VIEWS, REVIEW_FEE, queueOrders, receptionQueue, workAge } from './preview-model.js'
import { NAVIGATION, NEW_ORDER, PROFILES, applySystemAction, canVisit, createSystemState, initialProfile } from './system-model.js'
import { AccountForm, CustomerForm, DocumentPreview, Field, FormActions, NewOrderForm, UserForm } from './PreviewForms.jsx'
import { ActivityPage, BackupsPage, ClientsPage, Empty, OrdersTable, SearchBox, SettingsPage, SummaryPage, TrashPage, UsersPage } from './SystemPages.jsx'

const ICONS = { '/resumen': LayoutDashboard, '/recepcion': ClipboardList, '/taller': Wrench, '/terminados': Archive, '/ordenes': Inbox, '/clientes': Users, '/actividad': Activity, '/metricas': TrendingUp, '/usuarios': Shield, '/copias': DatabaseBackup, '/papelera': Trash2, '/configuracion': Settings }
const TITLES = { ...Object.fromEntries(NAVIGATION.flatMap((g) => g.items.map(([url, name]) => [url.slice(1), name]))), ajustes: 'Ajustes' }
const RECEPTION_ICONS = { presupuestar: Calculator, avisar: Bell, respuesta: MessageSquare, repuestos: Package, retiros: PackageCheck, externos: Truck, simples: Wrench }
const defaultDraft = (o, fee) => ({ ...RECEPTION_DRAFT, diagnosis: o.diagnosis, work: o.work, price: o.price || '', charge: String(fee ?? REVIEW_FEE), note: '', partName: '', partQuantity: '1' })

export default function FlowPreview() {
  const location = useLocation(), navigate = useNavigate()
  const [state, setState] = useState(createSystemState)
  const [role, setRole] = useState(() => initialProfile(location.pathname === '/' ? '/taller' : location.pathname))
  const [theme, setTheme] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  const [now, setNow] = useState(Date.now)
  const [queries, setQueries] = useState({})
  const [queues, setQueues] = useState({ taller: { view: 'mine', selected: 'demo-OS1042' }, recepcion: { view: 'presupuestar', selected: 'demo-OS1038' } })
  const [drafts, setDrafts] = useState({}), [forms, setForms] = useState({})
  const [modal, setModal] = useState(null), [menu, setMenu] = useState(false), [generation, setGeneration] = useState(0)
  const queueRef = useRef(null)
  const notify = useNotify('success')
  const [page, id] = location.pathname.slice(1).split('/')
  const queryKey = location.pathname
  const query = queries[queryKey] || {}
  const setQuery = (patch) => setQueries((previous) => ({ ...previous, [queryKey]: { ...previous[queryKey], ...patch } }))
  const counter = role !== 'tecnico'
  const orders = state.orders.filter((o) => !o.deletedAt)
  const isQueue = ['taller', 'recepcion'].includes(page)
  const queue = queues[page] || {}, queueRole = page === 'recepcion' ? 'recepcion' : 'tecnico'
  const view = queue.view || (page === 'recepcion' ? 'presupuestar' : 'mine')
  const list = isQueue ? queueOrders(orders, queueRole, view, queue.search || '') : []
  const order = orders.find((o) => o.id === (isQueue ? queue.selected : id))
  const patchQueue = (patch) => setQueues((previous) => ({ ...previous, [page]: { ...previous[page], ...patch } }))
  const patchDraft = (patch) => setDrafts((previous) => ({ ...previous, [order.id]: { ...previous[order.id], ...patch } }))
  const formKey = modal?.key || modal?.type
  const formValue = forms[formKey] || modal?.initial || {}
  const patchForm = (patch) => setForms((previous) => ({ ...previous, [formKey]: { ...formValue, ...patch } }))
  const clearForm = (key = formKey) => setForms((previous) => { const next = { ...previous }; delete next[key]; return next })

  useEffect(() => {
    const root = document.documentElement, previousDark = root.classList.contains('dark'), previousScheme = root.style.colorScheme
    root.classList.toggle('dark', theme === 'dark'); root.style.colorScheme = theme
    return () => { root.classList.toggle('dark', previousDark); root.style.colorScheme = previousScheme }
  }, [theme])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer) }, [])
  useEffect(() => { if (!canVisit(location.pathname, role)) navigate(PROFILES[role].home, { replace: true }) }, [location.pathname, role, navigate])
  useEffect(() => { setMenu(false); setModal(null) }, [location.pathname])

  const dispatch = (action, payload = {}) => {
    try { const next = applySystemAction(state, action, payload, role); setState(next); setNow(Date.now()); return next }
    catch (error) { notify({ type: 'error', text: error.message }); return null }
  }
  const saveForm = (action, payload, message) => {
    const next = dispatch(action, payload)
    if (next) { clearForm(); setModal(null); notify(message); return next }
  }
  const mutateOrder = (action, data) => {
    const next = dispatch('orderAction', { id: order.id, action, data })
    if (!next) return false
    const clear = ['saveWork', 'sendQuote', 'finish'].includes(action) ? ['diagnosis', 'work'] : action === 'price' ? ['price'] : action === 'note' ? ['note'] : action === 'requestPart' ? ['partName', 'partQuantity'] : ['approve', 'reject'].includes(action) ? ['response', 'charge'] : action === 'pickup' ? ['pickupBy', 'pickupName', 'pickupDni', 'physical', 'withoutReceipt'] : action === 'returnExternal' ? ['repaired'] : []
    setDrafts((previous) => { const kept = { ...previous[order.id] }; clear.forEach((key) => delete kept[key]); return { ...previous, [order.id]: kept } })
    notify(next.orders.find((o) => o.id === order.id).history.at(-1).text)
    return true
  }
  const changeRole = (next) => { setRole(next); setModal(null); navigate(PROFILES[next].home) }
  const openNewOrder = () => setModal({ type: 'newOrder', initial: NEW_ORDER })
  const openCustomer = (customer) => setModal({ type: 'customer', key: `customer-${customer?.id || 'new'}`, initial: customer || { name: '', phone: '', email: '', address: '' } })
  const openUser = (user) => setModal({ type: 'user', key: `user-${user?.id || 'new'}`, initial: user || { name: '', role: 'tecnico', active: true } })
  const confirm = (title, text, action) => setModal({ type: 'confirm', title, text, action })
  const performReset = () => {
    setState(createSystemState()); setNow(Date.now()); setDrafts({}); setForms({}); setQueries({}); setQueues({ taller: { view: 'mine', selected: 'demo-OS1042' }, recepcion: { view: 'presupuestar', selected: 'demo-OS1038' } }); setModal(null); setGeneration((n) => n + 1); navigate(PROFILES[role].home); notify('Demo reiniciada')
  }
  const reset = () => {
    if (Object.values(drafts).some((d) => Object.keys(d).length) || Object.keys(forms).length) confirm('Reiniciar demo', 'Se descartarán los borradores y los cambios de esta sesión.', performReset)
    else performReset()
  }
  const goOrders = (status) => { setQueries((q) => ({ ...q, '/ordenes': { status, page: 1 } })); navigate('/ordenes') }
  const goReception = (view) => { setQueues((q) => ({ ...q, recepcion: { ...q.recepcion, view, selected: queueOrders(orders, 'recepcion', view)[0]?.id, detail: false } })); navigate('/recepcion') }
  const extra = (type) => {
    if (['print', 'label'].includes(type)) setModal({ type: 'document', order, label: type === 'label' })
    else if (type === 'trash') confirm('Enviar a Papelera', `${order.number} · ${order.brand} ${order.model}`, () => { if (dispatch('trash', { kind: 'orders', id: order.id })) { setModal(null); navigate('/ordenes'); notify('Orden en Papelera') } })
    else if (type === 'warranty') confirm('Reingreso por garantía', `${order.number} · ${order.customer}`, () => { if (mutateOrder('warranty', {})) setModal(null) })
    else setModal({ type, initial: { name: state.settings.externals.split('\n')[0], repaired: true, technician: order?.assignedTo || state.users.find((u) => u.role === 'tecnico' && u.active)?.id } })
  }
  const Workspace = page === 'recepcion' ? ReceptionWorkspace : OrderWorkspace
  const renderOrder = () => order ? <Workspace users={state.users} key={`${generation}-${order.id}-${role}-${page}`} order={order} role={role} technical={role === 'tecnico' || (role === 'admin' && !receptionQueue(order))} draft={{ ...defaultDraft(order, state.settings.revisionFee), ...drafts[order.id] }} setDraft={patchDraft} onAction={mutateOrder} onBack={() => isQueue ? patchQueue({ detail: false }) : navigate(location.state?.from || '/ordenes')} onExtra={extra} /> : <div className="fp-order"><Empty text="Elegí un equipo" /></div>
  const changeView = (view) => patchQueue({ view, selected: queueOrders(orders, queueRole, view, queue.search || '')[0]?.id, detail: false, scroll: 0 })
  const queueKey = (e, index) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const target = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : Math.max(0, Math.min(list.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))
    queueRef.current?.querySelectorAll('.fp-queue-row')[target]?.focus()
  }
  const receptionTabKey = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? RECEPTION_VIEWS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + RECEPTION_VIEWS.length) % RECEPTION_VIEWS.length
    const key = RECEPTION_VIEWS[target][0]
    if (key !== view) changeView(key)
    event.currentTarget.closest('[role="tablist"]').querySelectorAll('[role="tab"]')[target].focus()
  }
  const pageContent = () => {
    if (isQueue) return <div className={page === 'recepcion' ? 'fp-reception-page' : undefined}>
      {page === 'recepcion' && <div className="fp-reception-filters" role="tablist" aria-label="Pendientes de recepción">{RECEPTION_VIEWS.map(([key, label], index) => { const Icon = RECEPTION_ICONS[key]; return <button key={key} id={`reception-tab-${key}`} role="tab" data-pending={key} aria-selected={view === key} aria-controls={`reception-panel-${key}`} tabIndex={view === key ? 0 : -1} onClick={() => { if (view !== key) changeView(key) }} onKeyDown={(event) => receptionTabKey(event, index)}><Icon size={16} aria-hidden="true" />{key === 'simples' ? 'Simples' : label}<span>{queueOrders(orders, queueRole, key).length}</span></button> })}</div>}
      {page === 'recepcion' && RECEPTION_VIEWS.filter(([key]) => key !== view).map(([key]) => <div key={key} role="tabpanel" id={`reception-panel-${key}`} aria-labelledby={`reception-tab-${key}`} hidden />)}
      <div role={page === 'recepcion' ? 'tabpanel' : undefined} id={page === 'recepcion' ? `reception-panel-${view}` : undefined} aria-labelledby={page === 'recepcion' ? `reception-tab-${view}` : undefined} className={`fp-workspace ${page === 'taller' ? 'fp-workspace-technical' : ''} ${queue.detail ? 'fp-show-detail' : ''}`}>
      <section className="fp-queue" aria-label="Cola de equipos"><div className="fp-queue-tools"><div className="fp-queue-title"><h2>{page === 'taller' ? 'Equipos del taller' : 'Por hacer'}</h2><span>{list.length} equipos</span></div><SearchBox label="Buscar equipo" value={queue.search} onChange={(search) => patchQueue({ search })} placeholder="N.º, equipo o cliente" />{page === 'taller' && <div className="fp-queue-filters" role="group" aria-label="Filtrar cola">{TECH_VIEWS.map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => changeView(key)}>{label}<span>{queueOrders(orders, queueRole, key).length}</span></button>)}</div>}</div>
      <div className="fp-queue-list" key={`${page}-${view}`} ref={(element) => { queueRef.current = element; if (element && Math.abs(element.scrollTop - (queue.scroll || 0)) > 2) element.scrollTop = queue.scroll || 0 }} onScroll={(e) => patchQueue({ scroll: e.currentTarget.scrollTop })}>{list.length ? list.map((item, index) => <button key={item.id} data-order={item.number} className={`fp-queue-row ${queue.selected === item.id ? 'selected' : ''}`} aria-current={queue.selected === item.id ? 'true' : undefined} onClick={() => patchQueue({ selected: item.id, detail: true })} onKeyDown={(e) => queueKey(e, index)}><div className="fp-row-device"><DeviceIcon type={item.deviceType} size={18} /><div className="fp-row-name"><strong>{item.brand} {item.model}</strong>{page === 'taller' && workAge(item, now) && <span className="fp-work-age">· {workAge(item, now)}</span>}</div><Status order={item} /></div><div className="fp-row-bottom"><p className="fp-row-issue">{item.issue}</p><ChevronRight size={14} /></div></button>) : <Empty text={queue.search ? 'Sin coincidencias' : 'Sin equipos'} />}</div></section>{renderOrder()}</div></div>
    if (page === 'ordenes' && id) return <><button className="fp-link fp-detail-back" onClick={() => navigate(location.state?.from || '/ordenes')}><ArrowLeft size={16} />Volver al listado</button><div className="fp-standalone-order">{renderOrder()}</div></>
    if (page === 'ordenes' || page === 'terminados') return <OrdersTable orders={page === 'terminados' ? orders.filter((o) => ['terminado', 'presupuesto_rechazado', 'entregado'].includes(o.status)) : orders} query={query} setQuery={setQuery} from={location.pathname} onExport={(rows) => setModal({ type: 'document', rows })} />
    if (page === 'resumen' || page === 'metricas') return <SummaryPage state={state} metrics={page === 'metricas'} goOrders={goOrders} goReception={goReception} />
    if (page === 'clientes') return <ClientsPage state={state} role={role} id={id} query={query} setQuery={setQuery} from={location.pathname} onEdit={openCustomer} onTrash={(c) => confirm('Enviar cliente a Papelera', `Se incluirán las órdenes de ${c.name}.`, () => { if (dispatch('trash', { kind: 'customers', id: c.id })) { setModal(null); navigate('/clientes'); notify('Cliente en Papelera') } })} />
    if (page === 'actividad') return <ActivityPage state={state} query={query} setQuery={setQuery} />
    if (page === 'usuarios') return <UsersPage state={state} onEdit={openUser} />
    if (page === 'copias') return <BackupsPage state={state} onCreate={() => { if (dispatch('backup')) notify('Copia creada en memoria') }} onRestore={(b) => confirm('Restaurar copia de demostración', 'Reemplazará los datos ficticios actuales y descartará los borradores.', () => { if (dispatch('restoreBackup', { id: b.id })) { setDrafts({}); setForms({}); setGeneration((n) => n + 1); setModal(null); notify('Copia restaurada en memoria') } })} />
    if (page === 'papelera') return <TrashPage state={state} query={query} setQuery={setQuery} onRestore={(kind, id) => { if (dispatch('restore', { kind, id })) notify('Elemento restaurado') }} />
    if (page === 'ajustes') return <section className="fp-card fp-card-pad"><h2>Mi cuenta</h2><div className="fp-facts-grid"><div><span>Nombre</span><p>{PROFILES[role].name}</p></div><div><span>Perfil</span><p>{PROFILES[role].label}</p></div></div><div className="fp-inline-actions fp-account-settings"><button className="fp-button secondary" onClick={() => setModal({ type: 'profile' })}>Editar perfil</button><button className="fp-button secondary" onClick={() => setModal({ type: 'password' })}>Cambiar contraseña</button></div></section>
    if (page === 'configuracion') return <SettingsPage state={state} tab={query.tab || 'general'} setTab={(tab) => setQuery({ tab })} value={{ ...state.settings, catalogText: '', ...forms.settings }} set={(patch) => setForms((f) => ({ ...f, settings: { ...f.settings, ...patch } }))} onSave={() => { const { catalogText: _text, ...settings } = forms.settings || {}; if (dispatch('settings', settings)) { clearForm('settings'); notify('Configuración guardada') } }} onImport={(text) => { if (dispatch('catalog', { text })) { setForms((f) => ({ ...f, settings: { ...f.settings, catalogText: '' } })); notify('Modelos agregados') } }} onTest={(label) => setModal({ type: 'document', order: orders[0], label })} />
    return <Empty text="Pantalla no disponible" />
  }
  const modalTitle = { newOrder: 'Nueva orden', customer: formValue.id ? 'Editar cliente' : 'Nuevo cliente', user: formValue.id ? 'Editar usuario' : 'Nuevo usuario', document: modal?.label ? 'Vista previa de etiqueta' : 'Vista previa', profile: 'Mi perfil', password: 'Cambiar contraseña', sendExternal: 'Enviar a técnico externo', returnExternal: 'Registrar regreso' }[modal?.type] || modal?.title

  return <div className="flow-demo" data-theme={theme}>
    <div className="fp-demo-bar"><span><FlaskConical size={15} /><strong>Demo</strong><span className="fp-demo-description">Datos ficticios</span></span><div className="fp-demo-tools"><label className="fp-profile-picker">Perfil<select aria-label="Perfil de demostración" value={role} onChange={(e) => changeRole(e.target.value)}>{Object.entries(PROFILES).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}</select></label><button onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span className="fp-theme-text">{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span></button><button onClick={reset} aria-label="Reiniciar demo"><RotateCcw size={15} /><span className="fp-reset-text">Reiniciar demo</span></button></div></div>
    {page === 'acceso' ? <main className="fp-login"><section className="fp-card fp-card-pad"><img src={logo} alt="" /><h1>Service Center</h1><p className="fp-muted">Acceso simulado · Datos ficticios</p><form className="fp-form" onSubmit={(e) => { e.preventDefault(); changeRole(role); notify('Acceso simulado') }}><Field label="Perfil"><select value={role} onChange={(e) => setRole(e.target.value)}>{Object.entries(PROFILES).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}</select></Field><Field label="Usuario ficticio" placeholder="usuario.demo" autoComplete="off" /><Field label="Contraseña ficticia" type="password" autoComplete="off" /><button className="fp-button primary">Entrar a la demo<LogIn size={16} /></button></form></section></main> : <div className="fp-shell">
      <div className="fp-mobile-top"><button className="fp-button secondary" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-controls="preview-navigation">{menu ? <X size={18} /> : <Menu size={18} />}Menú</button><span>{state.settings.business}</span><ProfileMenu role={role} onChange={changeRole} compact /></div>
      <aside id="preview-navigation" className={`fp-sidebar ${menu ? 'fp-menu-open' : ''}`}><div className="fp-brand"><img src={logo} alt="" /><div><strong>{state.settings.business}</strong><span>Service Center</span></div></div><nav aria-label="Navegación de demostración" className="fp-navigation">{NAVIGATION.map(({ group, items }) => <div key={group}>{items.some(([, , roles]) => !roles || roles.includes(role)) && <span className="fp-nav-group">{group}</span>}{items.filter(([, , roles]) => !roles || roles.includes(role)).map(([url, label]) => { const Icon = ICONS[url]; return <Link className={location.pathname === url || location.pathname.startsWith(`${url}/`) ? 'active' : ''} aria-current={location.pathname === url ? 'page' : undefined} key={url} to={url}><Icon size={17} />{label}</Link> })}</div>)}</nav><div className="fp-account"><ProfileMenu role={role} onChange={changeRole} /><div className="fp-account-actions"><Link className="fp-button secondary" to="/ajustes"><Settings size={15} />Ajustes</Link><Link className="fp-button secondary" to="/acceso"><LogIn size={15} />Salir</Link></div></div></aside>
      <main className="fp-main"><header className="fp-page-heading"><div><p>Service Center<ChevronRight size={12} />{TITLES[page]}</p><h1>{page === 'taller' ? 'Mesa de trabajo' : page === 'recepcion' ? 'Pendientes de recepción' : id && page === 'ordenes' ? 'Detalle de orden' : TITLES[page]}</h1></div><div className="fp-inline-actions">{counter && ['recepcion', 'ordenes', 'resumen'].includes(page) && !id && <button className="fp-button primary" onClick={openNewOrder}><Plus size={16} />Nueva orden</button>}{page === 'clientes' && !id && <button className="fp-button primary" onClick={() => openCustomer()}><Plus size={16} />Nuevo cliente</button>}{page === 'usuarios' && <button className="fp-button primary" onClick={() => openUser()}><Plus size={16} />Nuevo usuario</button>}</div></header>{canVisit(location.pathname, role) && pageContent()}</main>
    </div>}
    {modal && <ToolWindow title={modalTitle} onClose={() => setModal(null)}>
      {modal.type === 'newOrder' && <NewOrderForm state={state} value={formValue} set={patchForm} onClose={() => setModal(null)} onSubmit={(data) => { const next = saveForm('createOrder', data, 'Orden creada'); if (next) navigate(`/ordenes/${next.orders.at(-1).id}`, { state: { from: '/recepcion' } }) }} />}
      {modal.type === 'customer' && <CustomerForm value={formValue} set={patchForm} onClose={() => setModal(null)} onSubmit={(data) => saveForm('customer', data, 'Cliente guardado')} />}
      {modal.type === 'user' && <UserForm value={formValue} set={patchForm} onClose={() => setModal(null)} onSubmit={(data) => saveForm('user', data, 'Usuario guardado')} />}
      {modal.type === 'document' && <DocumentPreview state={state} order={modal.order} label={modal.label} rows={modal.rows || []} />}
      {['profile', 'password'].includes(modal.type) && <AccountForm role={role} type={modal.type} onClose={() => setModal(null)} onSubmit={() => { setModal(null); notify('Cambio simulado. No modifica credenciales reales.') }} />}
      {modal.type === 'assign' && <form className="fp-form" onSubmit={(e) => { e.preventDefault(); saveForm('assign', { id: order.id, technician: formValue.technician }, 'Técnico asignado') }}><Field label="Técnico"><select value={formValue.technician} onChange={(e) => patchForm({ technician: e.target.value })}>{state.users.filter((u) => u.active && u.role === 'tecnico').map((u) => <option value={u.id} key={u.id}>{u.name}</option>)}</select></Field><FormActions onClose={() => setModal(null)} /></form>}
      {['sendExternal', 'returnExternal'].includes(modal.type) && <form className="fp-form" onSubmit={(e) => { e.preventDefault(); if (mutateOrder(modal.type, formValue)) { clearForm(); setModal(null) } }}>{modal.type === 'sendExternal' ? <Field label="Técnico externo"><select value={formValue.name} onChange={(e) => patchForm({ name: e.target.value })}>{state.settings.externals.split('\n').filter(Boolean).map((name) => <option key={name}>{name}</option>)}</select></Field> : <><p>{order?.externalTech}</p><label className="fp-checkbox"><input type="checkbox" checked={formValue.repaired} onChange={(e) => patchForm({ repaired: e.target.checked })} />Reparación finalizada</label></>}<FormActions onClose={() => setModal(null)} /></form>}
      {modal.type === 'confirm' && <div className="fp-form"><p>{modal.text}</p><div className="fp-form-actions"><button className="fp-button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="fp-button primary" onClick={modal.action}>Confirmar</button></div></div>}
    </ToolWindow>}
  </div>
}
