// ============================================
// Orders: listado de órdenes de servicio en tabla
// (estilo planilla, con ordenamiento, filtros y paginación)
// ============================================
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, ArrowUp, ArrowDown, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import OrderForm from '../components/OrderForm.jsx'
import PrintOrderPanel from '../components/PrintOrderPanel.jsx'
import { ORDER_STATUS_LABEL, orderStatusTone, formatDate, formatMoney, titleCase } from '../utils/helpers.js'
import { DEVICE_TYPES } from '../../shared/fsm.js'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function Orders() {
  const { loadOrders, customers, printLabel, ordersRevision } = useData()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [pageData, setPageData] = useState({ orders: [], total: 0 })

  // Filtros
  const [q, setQ] = useState(() => params.get('q') || '')
  const [qInput, setQInput] = useState(() => params.get('q') || '')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [brand, setBrand] = useState('all')
  const [deviceType, setDeviceType] = useState('all')
  const [onlyNotNotified, setOnlyNotNotified] = useState(false)
  const [onlyNotConfirmed, setOnlyNotConfirmed] = useState(false)

  // Ordenamiento
  const [sortKey, setSortKey] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')

  // Paginación
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1])

  // Búsqueda con debounce para no consultar el servidor en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 300)
    return () => clearTimeout(t)
  }, [qInput])

  // Carga paginada desde el servidor (no todo el histórico en memoria).
  useEffect(() => {
    const offset = (page - 1) * pageSize
    loadOrders({ status, q, from, to, brand, deviceType, onlyNotNotified, onlyNotConfirmed, limit: pageSize, offset })
      .then(setPageData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadOrders, status, q, from, to, brand, deviceType, onlyNotNotified, onlyNotConfirmed, page, pageSize, ordersRevision])

  const [formOpen, setFormOpen] = useState(false)
  const [printing, setPrinting] = useState(null)
  const [notice, setNotice] = useState(null)
  const canCreate = ['recepcion', 'admin'].includes(currentUser?.role)

  const brands = useMemo(
    () => [...new Set(pageData.orders.map((o) => o.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es-AR')),
    [pageData.orders],
  )

  // Los filtros ya se aplican en el servidor; acá solo tenemos la página actual.
  const filtered = pageData.orders

  const sorted = useMemo(() => {
    const cmp = (a, b) => {
      switch (sortKey) {
        case 'price':
        case 'advance':
          return (Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0)
        case 'status':
          return ORDER_STATUS_LABEL[a.status].localeCompare(ORDER_STATUS_LABEL[b.status], 'es-AR')
        case 'orderNumber':
          return a.orderNumber.localeCompare(b.orderNumber, 'es-AR', { numeric: true })
        default: {
          const va = a[sortKey] || ''
          const vb = b[sortKey] || ''
          return String(va).localeCompare(String(vb), 'es-AR')
        }
      }
    }
    const list = [...filtered].sort(cmp)
    return sortDir === 'desc' ? list.reverse() : list
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(pageData.total / pageSize))
  const safePage = Math.max(1, Math.min(page, totalPages))
  const paged = sorted

  const hasFilters = q.trim() || status !== 'all' || brand !== 'all' || deviceType !== 'all' || from || to || onlyNotNotified || onlyNotConfirmed

  const clearFilters = () => {
    setQ('')
    setQInput('')
    setStatus('all')
    setBrand('all')
    setDeviceType('all')
    setFrom('')
    setTo('')
    setOnlyNotNotified(false)
    setOnlyNotConfirmed(false)
    setPage(1)
  }

  const toggleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const customerOf = (o) => customers.find((c) => c.id === o.customerId)

  const onCreated = async (order) => {
    const res = await printLabel(order.id)
    setNotice(res.error
      ? { text: `No se imprimió la etiqueta: ${res.error}`, error: true }
      : { text: 'Etiqueta enviada a la impresora.', error: false })
    window.setTimeout(() => setNotice(null), 6000)
    setPrinting({ order, customer: customerOf(order) })
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  const checkboxCls = 'h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600'

  const thCls =
    'group cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronsUpDown size={12} className="ml-1 inline opacity-40" />
    return sortDir === 'asc' ? <ArrowUp size={12} className="ml-1 inline" /> : <ArrowDown size={12} className="ml-1 inline" />
  }

  const Th = ({ col, className = '', children }) => (
    <th onClick={() => toggleSort(col)} className={`${thCls} ${className}`}>
      <span className="inline-flex items-center">
        {children}
        <SortIcon col={col} />
      </span>
    </th>
  )

  const navBtn =
    'inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Órdenes de servicio</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{pageData.total} orden(es)</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 self-start rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            <Plus size={16} />
            Nueva orden
          </button>
        )}
      </div>

      {notice && (
        <p className={`rounded-lg px-4 py-2 text-sm ${notice.error
          ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>
          {notice.text}
        </p>
      )}

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          {/* Fila 1: búsqueda + selects */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={qInput}
                onChange={(e) => { setQInput(e.target.value); setPage(1) }}
                placeholder="Buscar por N.º, cliente o equipo..."
                className={`${inputCls} pl-9`}
              />
            </div>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className={`${inputCls} sm:w-48`}>
              <option value="all">Todos los estados</option>
              {Object.entries(ORDER_STATUS_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select value={deviceType} onChange={(e) => { setDeviceType(e.target.value); setPage(1) }} className={`${inputCls} sm:w-40`}>
              <option value="all">Todos los tipos</option>
              {DEVICE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select value={brand} onChange={(e) => { setBrand(e.target.value); setPage(1) }} className={`${inputCls} sm:w-40`}>
              <option value="all">Todas las marcas</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          {/* Fila 2: fechas + filtros rápidos + limpiar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex gap-2">
              <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} className={`${inputCls} !w-auto`} title="Desde" />
              <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} className={`${inputCls} !w-auto`} title="Hasta" />
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <button
                onClick={() => { setOnlyNotNotified((v) => !v); setPage(1) }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  onlyNotNotified
                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800/50'
                }`}
              >
                Sin avisar
              </button>
              <button
                onClick={() => { setOnlyNotConfirmed((v) => !v); setPage(1) }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  onlyNotConfirmed
                    ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-400'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-800/50'
                }`}
              >
                Sin confirmar
              </button>
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
              >
                <X size={13} />
                Limpiar
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden">
        {paged.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            No hay órdenes que coincidan con la búsqueda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                  <Th col="orderNumber">Nº</Th>
                  <Th col="customerName">Cliente</Th>
                  <Th col="model">Equipo</Th>
                  <Th col="diagnosisType">Tipo</Th>
                  <Th col="price" className="text-right">Precio</Th>
                  <Th col="status">Estado</Th>
                  <Th col="notified">Aviso</Th>
                  <Th col="createdAt">Fecha</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paged.map((o, i) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/ordenes/${o.id}`)}
                    className={`cursor-pointer transition hover:bg-primary-50 dark:hover:bg-primary-500/10 ${
                      i % 2 === 1 ? 'bg-slate-50/60 dark:bg-slate-800/30' : ''
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-900 dark:text-white">{o.orderNumber}</td>
                    <td className="max-w-[160px] truncate px-3 py-2.5 font-medium text-slate-700 dark:text-slate-200" title={o.customerName}>
                      {titleCase(o.customerName)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-200">{titleCase(o.brand)} {titleCase(o.model)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Badge tone={o.diagnosisType === 'revision' ? 'primary' : 'slate'}>
                        {o.diagnosisType === 'revision' ? 'Revisión' : 'Reparación'}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-900 dark:text-white">
                      {o.price ? formatMoney(o.price) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Badge tone={orderStatusTone(o.status)}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {['presupuesto', 'terminado'].includes(o.status) && (
                        o.notified ? (
                          <Badge tone="green">Avisado</Badge>
                        ) : (
                          <Badge tone="yellow">Sin avisar</Badge>
                        )
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-500 dark:text-slate-400">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {pageData.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Mostrando</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>por página · {pageData.total} en total</span>
            </div>
            <div className="flex items-center gap-2">
              <button className={navBtn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                <ChevronUp size={14} className="rotate-90" />
                Anterior
              </button>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {safePage} / {totalPages}
              </span>
              <button className={navBtn} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                Siguiente
                <ChevronDown size={14} className="-rotate-90" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {canCreate && <OrderForm open={formOpen} onClose={() => setFormOpen(false)} onCreated={onCreated} />}
      <PrintOrderPanel
        open={!!printing}
        order={printing?.order}
        customer={printing?.customer}
        onClose={() => setPrinting(null)}
      />
    </div>
  )
}