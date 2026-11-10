import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Search, Plus, FileText, Bell, MessageCircle, Package, PackageCheck, Truck, Wrench, Inbox, Users } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useWorkspaceState } from '../context/workspace.js'
import { receptionQueue } from '../../shared/order-workspace.js'
import { timeAgo, toTime } from '../utils/helpers.js'
import { OrderStatus } from './OrderSheet.jsx'
import OrderDetail from '../pages/OrderDetail.jsx'
import OrderForm from './OrderForm.jsx'
import PrintOrderPanel from './PrintOrderPanel.jsx'
import Tabs from './Tabs.jsx'
import PageHeading from './PageHeading.jsx'

const receptionTabs = [['presupuestar', 'Presupuestar', FileText], ['avisar', 'Avisar', Bell], ['respuesta', 'Respuesta', MessageCircle], ['repuestos', 'Repuestos', Package], ['retiros', 'Retiros', PackageCheck], ['externos', 'Externos', Truck], ['simples', 'Simples', Wrench]]
const workshopTabs = [['mine', 'Mis equipos', Wrench], ['available', 'Sin asignar', Inbox], ['all', 'Todos', Users]]
const workshopStatuses = ['recibido', 'en_revision', 'en_reparacion', 'presupuesto', 'falta_repuestos']

export default function OrderQueue({ reception = false }) {
  const { orders, loading } = useData()
  const { currentUser } = useAuth()
  const technician = currentUser.role === 'tecnico'
  const [view, setView] = useWorkspaceState(`queue:${reception ? 'recepcion' : 'taller'}`, { tab: reception ? 'presupuestar' : technician ? 'mine' : 'all', search: '', selected: null, detail: false, scroll: 0 })
  const patch = useCallback((fields) => setView((previous) => ({ ...previous, ...fields })), [setView])
  const [formOpen, setFormOpen] = useState(false)
  const [printing, setPrinting] = useState(null)
  const [selection, setSelection] = useState(null)
  const [, tick] = useState(0)
  const listRef = useRef(null)
  useEffect(() => { const timer = setInterval(() => tick((value) => value + 1), 60000); return () => clearInterval(timer) }, [])
  const tabs = reception ? receptionTabs : workshopTabs.filter(([key]) => key !== 'mine' || technician)
  const tab = !reception && !technician && view.tab === 'mine' ? 'all' : view.tab
  const matching = useCallback((order, tab) => reception ? receptionQueue(order) === tab : !order.isSimpleService && !(order.isExternal && order.status === 'recibido') && workshopStatuses.includes(order.status) && (tab === 'all' || tab === 'mine' && order.assignedTo === currentUser.id || tab === 'available' && !order.assignedTo), [reception, currentUser.id])
  const rows = useMemo(() => orders.filter((order) => matching(order, tab) && `${order.orderNumber} ${order.brand} ${order.model} ${order.customerName} ${order.issue}`.toLocaleLowerCase('es').includes(view.search.trim().toLocaleLowerCase('es'))).sort((a, b) => toTime(b.history?.at(-1)?.at || b.createdAt) - toTime(a.history?.at(-1)?.at || a.createdAt)), [orders, tab, view.search, matching])
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = view.scroll }, [view.scroll])
  const active = orders.find((order) => order.id === selection?.id)
  const continuingWork = !reception && ['en_revision', 'en_reparacion'].includes(active?.status) && (active.assignedTo === selection?.assignedTo || !selection?.assignedTo && active.assignedTo === currentUser.id)
  const takingOwnWork = technician && continuingWork && tab === 'available' && active.assignedTo === currentUser.id
  const reassigned = !reception && technician && selection?.assignedTo === currentUser.id && active?.assignedTo !== currentUser.id
  const invalid = !!selection && (!active || reassigned || active.status !== selection.status && !continuingWork || !matching(active, tab) && !takingOwnWork)
  useEffect(() => {
    if (!selection || invalid || !continuingWork) return
    if (active.status !== selection.status || active.assignedTo !== selection.assignedTo) setSelection({ id: active.id, status: active.status, assignedTo: active.assignedTo })
    if (takingOwnWork) patch({ tab: 'mine' })
  }, [active, selection, invalid, continuingWork, takingOwnWork, patch])
  const selected = invalid ? null : selection?.id
  const choose = (order) => { setSelection({ id: order.id, status: order.status, assignedTo: order.assignedTo }); patch({ detail: true }) }
  const chooseTab = (tab) => {
    setSelection(null)
    patch({ tab, detail: false, scroll: 0 })
    if (listRef.current) listRef.current.scrollTop = 0
  }
  return <div className={`ws-page ${reception ? 'ws-reception' : ''}`}>
    <PageHeading title={reception ? 'Recepción' : 'Taller'} description={reception ? 'Seguimiento y atención al cliente' : 'Revisión y reparación de equipos'}>{reception && <button className="ws-button primary" onClick={() => setFormOpen(true)}><Plus size={16} />Nueva orden</button>}</PageHeading>
    <Tabs id="queue" label={reception ? 'Pendientes de recepción' : 'Trabajos del taller'} panelId="queue-panel" value={tab} onChange={chooseTab} items={tabs.map(([key, label, Icon]) => ({ key, label, Icon, count: orders.filter((order) => matching(order, key)).length }))} />
    <div className="ws-panel">
      <div id="queue-panel" role="tabpanel" aria-labelledby={`queue-${tab}`} className={`ws-layout ${selected && view.detail ? 'ws-detail-open' : ''}`}>
        <aside className="ws-queue" aria-label="Cola de equipos"><label className="ws-search"><Search size={17} /><span className="sr-only">Buscar equipo</span><input value={view.search} onChange={(event) => patch({ search: event.target.value })} placeholder="Buscar equipo, cliente u orden" /></label><div className="ws-queue-list" ref={listRef} onScroll={(event) => patch({ scroll: event.currentTarget.scrollTop })}>
          {rows.map((order, index) => { const at = order.history?.at(-1)?.at || order.createdAt; return <button key={order.id} data-order-id={order.id} className={`ws-queue-row ${selected === order.id ? 'selected' : ''}`} aria-pressed={selected === order.id} onClick={() => choose(order)} onKeyDown={(event) => { if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); const next = Math.min(rows.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1))); choose(rows[next]); event.currentTarget.parentElement.children[next].focus() }}><div className="ws-row-top"><div className="ws-row-name"><span>{order.brand} {order.model}</span>{!reception && ['mine', 'available'].includes(tab) && <span className="ws-age" title="Última actualización">· {at ? timeAgo(at) : 'Sin fecha'}</span>}</div><OrderStatus order={order} /></div><div className="ws-row-bottom"><span>{order.issue || order.fix || 'Sin notas generales'}</span><ArrowRight size={16} /></div></button> })}
          {!rows.length && <p className="ws-empty">{loading ? 'Cargando…' : 'Sin equipos'}</p>}
        </div></aside>
        {selection && <OrderDetail key={selection.id} orderId={selection.id} technical={!reception} embedded hiddenSheet={invalid} onDismiss={() => { setSelection(null); patch({ detail: false }) }} onBack={() => patch({ detail: false })} />}
        {!selected && <div className="ws-order ws-empty">Elegí un equipo</div>}
      </div>
    </div>
    <OrderForm open={formOpen} onClose={() => setFormOpen(false)} onCreated={(order) => { setPrinting(order) }} />
    <PrintOrderPanel open={!!printing} order={printing} onClose={() => setPrinting(null)} />
  </div>
}
