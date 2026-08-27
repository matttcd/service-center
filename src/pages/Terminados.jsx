// ============================================
// Terminados: tabla de equipos terminados listos para entregar.
// ============================================
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowUp, ArrowDown, ChevronsUpDown, ChevronUp, ChevronDown, X } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { timeSinceStatus, formatMoney, titleCase } from '../utils/helpers.js'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function timeSinceColor(order) {
  const text = timeSinceStatus(order, order.status)
  if (!text) return 'text-slate-500 dark:text-slate-400'
  if (text.includes('minuto') || text.includes('hora')) return 'text-slate-500 dark:text-slate-400'
  if (text.includes('día')) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export default function Terminados() {
  const { loadOrders, ordersRevision } = useData()
  const navigate = useNavigate()

  const [pageData, setPageData] = useState({ orders: [], total: 0 })
  const [q, setQ] = useState('')
  const [qInput, setQInput] = useState('')
  const [notifiedFilter, setNotifiedFilter] = useState('all')
  const [sortKey, setSortKey] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 300)
    return () => clearTimeout(t)
  }, [qInput])

  useEffect(() => {
    const offset = (page - 1) * pageSize
    const filters = { status: 'terminado', q, limit: pageSize, offset }
    if (notifiedFilter === 'not_notified') filters.onlyNotNotified = '1'
    if (notifiedFilter === 'notified') filters.onlyNotified = '1'
    loadOrders(filters).then(setPageData)
  }, [loadOrders, q, notifiedFilter, page, pageSize, ordersRevision])

  const sorted = useMemo(() => {
    const cmp = (a, b) => {
      switch (sortKey) {
        case 'price':
          return (Number(a.price) || 0) - (Number(b.price) || 0)
        case 'orderNumber':
          return a.orderNumber.localeCompare(b.orderNumber, 'es-AR', { numeric: true })
        case 'timeWaiting': {
          const la = a.history?.[a.history.length - 1]?.at || a.createdAt
          const lb = b.history?.[b.history.length - 1]?.at || b.createdAt
          return new Date(la) - new Date(lb)
        }
        default: {
          const va = a[sortKey] || ''
          const vb = b[sortKey] || ''
          return String(va).localeCompare(String(vb), 'es-AR')
        }
      }
    }
    const list = [...pageData.orders].sort(cmp)
    return sortDir === 'desc' ? list.reverse() : list
  }, [pageData.orders, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(pageData.total / pageSize))
  const safePage = Math.max(1, Math.min(page, totalPages))

  const hasFilters = q.trim() || notifiedFilter !== 'all'

  const clearFilters = () => {
    setQ('')
    setQInput('')
    setNotifiedFilter('all')
    setPage(1)
  }

  const toggleSort = (key) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  const thCls =
    'group cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronsUpDown size={12} className="ml-1 inline opacity-40" />
    return sortDir === 'asc' ? <ArrowUp size={12} className="ml-1 inline" /> : <ArrowDown size={12} className="ml-1 inline" />
  }

  const Th = ({ col, className = '', children }) => (
    <th onClick={() => toggleSort(col)} className={`${thCls} ${className}`}>
      <span className="inline-flex items-center">{children}<SortIcon col={col} /></span>
    </th>
  )

  const navBtn =
    'inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Terminados</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{pageData.total} equipo(s) listo(s) para entregar</p>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'Todas' },
              { key: 'not_notified', label: 'Sin avisar' },
              { key: 'notified', label: 'Avisadas' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => { setNotifiedFilter(f.key); setPage(1) }}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  notifiedFilter === f.key
                    ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-400'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
            >
              <X size={13} />
              Limpiar
            </button>
          )}
        </div>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden">
        {sorted.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            No hay equipos terminados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                  <Th col="orderNumber">Nº</Th>
                  <Th col="customerName">Cliente</Th>
                  <Th col="model">Equipo</Th>
                  <Th col="diagnosisType">Tipo</Th>
                  <Th col="price" className="text-right">Precio</Th>
                  <Th col="notified">Aviso</Th>
                  <Th col="timeWaiting">Tiempo</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sorted.map((o, i) => (
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
                      {o.notified
                        ? <Badge tone="green">Avisado</Badge>
                        : <Badge tone="yellow">Sin avisar</Badge>
                      }
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2.5 font-medium ${timeSinceColor(o)}`}>
                      {timeSinceStatus(o, o.status)}
                    </td>
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
    </div>
  )
}
