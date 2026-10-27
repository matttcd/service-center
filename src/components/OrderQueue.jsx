import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Search, Plus, FileText, Bell, MessageCircle, Package, PackageCheck, Truck, Wrench, Inbox, Users } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useWorkspaceState } from '../context/workspace.js'
import { acceptanceDate, receptionQueue } from '../../shared/order-workspace.js'
import { timeAgo, toTime } from '../utils/helpers.js'
import { OrderStatus } from './OrderSheet.jsx'
import OrderDetail from '../pages/OrderDetail.jsx'
import OrderForm from './OrderForm.jsx'
import PrintOrderPanel from './PrintOrderPanel.jsx'

const receptionTabs = [['presupuestar', 'Presupuestar', FileText], ['avisar', 'Avisar', Bell], ['respuesta', 'Respuesta', MessageCircle], ['repuestos', 'Repuestos', Package], ['retiros', 'Retiros', PackageCheck], ['externos', 'Externos', Truck], ['simples', 'Simples', Wrench]]
const workshopTabs = [['mine', 'Mis trabajos', Wrench], ['available', 'Sin asignar', Inbox], ['all', 'Todo el taller', Users]]
const workshopStatuses = ['recibido', 'en_revision', 'en_reparacion', 'presupuesto', 'falta_repuestos']

export default function OrderQueue({ reception = false }) {
  const { orders, loading } = useData()
  const { currentUser } = useAuth()
  const [view, setView] = useWorkspaceState(`queue:${reception ? 'recepcion' : 'taller'}`, { tab: reception ? 'presupuestar' : currentUser.role === 'tecnico' ? 'mine' : 'all', search: '', selected: null, detail: false, scroll: 0 })
  const patch = useCallback((fields) => setView((previous) => ({ ...previous, ...fields })), [setView])
  const [formOpen, setFormOpen] = useState(false)
  const [printing, setPrinting] = useState(null)
  const [, tick] = useState(0)
  const listRef = useRef(null)
  useEffect(() => { const timer = setInterval(() => tick((value) => value + 1), 60000); return () => clearInterval(timer) }, [])
  const tabs = reception ? receptionTabs : workshopTabs
  const matching = useCallback((order, tab) => reception ? receptionQueue(order) === tab : !order.isSimpleService && !(order.isExternal && order.status === 'recibido') && workshopStatuses.includes(order.status) && (tab === 'all' || tab === 'mine' && order.assignedTo === currentUser.id || tab === 'available' && !order.assignedTo), [reception, currentUser.id])
  const rows = useMemo(() => orders.filter((order) => matching(order, view.tab) && `${order.orderNumber} ${order.brand} ${order.model} ${order.customerName} ${order.issue}`.toLocaleLowerCase('es').includes(view.search.trim().toLocaleLowerCase('es'))).sort((a, b) => toTime(b.history?.at(-1)?.at || b.createdAt) - toTime(a.history?.at(-1)?.at || a.createdAt)), [orders, view.tab, view.search, matching])
  useEffect(() => { if (!view.selected && rows.length) patch({ selected: rows[0].id }) }, [rows, view.selected, patch])
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = view.scroll }, [view.scroll])
  const selected = view.selected || rows[0]?.id
  const chooseTab = (tab) => {
    const first = orders.filter((order) => matching(order, tab) && `${order.orderNumber} ${order.brand} ${order.model} ${order.customerName} ${order.issue}`.toLocaleLowerCase('es').includes(view.search.trim().toLocaleLowerCase('es'))).sort((a, b) => toTime(b.history?.at(-1)?.at || b.createdAt) - toTime(a.history?.at(-1)?.at || a.createdAt))[0]
    patch({ tab, selected: first?.id || null, scroll: 0 })
    if (listRef.current) listRef.current.scrollTop = 0
  }
  return <div className={`ws-page ${reception ? 'ws-reception' : ''}`}>
    <div className="ws-heading"><h1>{reception ? 'Recepción' : 'Taller'}</h1>{reception && <button className="ws-button primary" onClick={() => setFormOpen(true)}><Plus size={16} />Nueva orden</button>}</div>
    <div className="ws-panel">
      <div className="ws-tabs" role="tablist" aria-label={reception ? 'Pendientes de recepción' : 'Trabajos del taller'} onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const index = tabs.findIndex(([id]) => id === view.tab)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
        chooseTab(tabs[next][0]); event.currentTarget.querySelectorAll('[role=tab]')[next].focus()
      }}>{tabs.map(([id, label, Icon]) => <button key={id} id={`queue-${id}`} role="tab" aria-selected={view.tab === id} tabIndex={view.tab === id ? 0 : -1} aria-controls="queue-panel" onClick={() => chooseTab(id)}><Icon size={16} />{label}<span>{orders.filter((order) => matching(order, id)).length}</span></button>)}</div>
      <div id="queue-panel" role="tabpanel" aria-labelledby={`queue-${view.tab}`} className={`ws-layout ${view.detail ? 'ws-detail-open' : ''}`}>
        <aside className="ws-queue" aria-label="Cola de equipos"><label className="ws-search"><Search size={17} /><span className="sr-only">Buscar equipo</span><input value={view.search} onChange={(event) => patch({ search: event.target.value })} placeholder="Buscar equipo, cliente u orden" /></label><div className="ws-queue-list" ref={listRef} onScroll={(event) => patch({ scroll: event.currentTarget.scrollTop })}>
          {rows.map((order, index) => { const at = acceptanceDate(order); return <button key={order.id} data-order-id={order.id} className={`ws-queue-row ${selected === order.id ? 'selected' : ''}`} aria-pressed={selected === order.id} onClick={() => patch({ selected: order.id, detail: true })} onKeyDown={(event) => { if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); const next = Math.min(rows.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1))); patch({ selected: rows[next].id }); event.currentTarget.parentElement.children[next].focus() }}><div className="ws-row-top"><div className="ws-row-name"><span>{order.brand} {order.model}</span>{!reception && view.tab === 'mine' && <span className="ws-age">· {at ? timeAgo(at) : 'Sin fecha'}</span>}</div><OrderStatus order={order} /></div><div className="ws-row-bottom"><span>{order.issue || order.fix || 'Sin notas generales'}</span><ArrowRight size={16} /></div></button> })}
          {!rows.length && <p className="ws-empty">{loading ? 'Cargando…' : 'Sin equipos'}</p>}
        </div></aside>
        {selected ? <OrderDetail key={selected} orderId={selected} technical={!reception} embedded onBack={() => patch({ detail: false })} /> : <div className="ws-order ws-empty">Elegí un equipo</div>}
      </div>
    </div>
    <OrderForm open={formOpen} onClose={() => setFormOpen(false)} onCreated={(order) => { patch({ selected: order.id, detail: true }); setPrinting(order) }} />
    <PrintOrderPanel open={!!printing} order={printing} onClose={() => setPrinting(null)} />
  </div>
}
