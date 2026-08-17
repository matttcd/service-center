// ============================================
// Orders: listado de órdenes de servicio
// ============================================
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, Eye } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import OrderForm from '../components/OrderForm.jsx'
import OrderPrint from '../components/OrderPrint.jsx'
import {
  orderStatus,
  ORDER_STATUS_LABEL,
  orderStatusTone,
  formatDate,
} from '../utils/helpers.js'

export default function Orders() {
  const { orders, customers } = useData()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState(() => params.get('q') || '')
  const [formOpen, setFormOpen] = useState(false)
  const [printing, setPrinting] = useState(null)

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return orders
      .map((o) => ({ ...o, status: orderStatus(o) }))
      .filter((o) => (status === 'all' ? true : o.status === status))
      .filter((o) => {
        if (!query) return true
        return (
          o.orderNumber.toLowerCase().includes(query) ||
          (o.customerName || '').toLowerCase().includes(query) ||
          (o.items || []).some(
            (i) =>
              `${i.brand} ${i.model}`.toLowerCase().includes(query) ||
              (i.imei || '').toLowerCase().includes(query),
          )
        )
      })
  }, [orders, status, q])

  const customerOf = (o) => customers.find((c) => c.id === o.customerId)

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Órdenes de servicio</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filtered.length} orden(es)
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 self-start rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          <Plus size={16} />
          Nueva orden
        </button>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por N.º, cliente, equipo o IMEI..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} sm:w-56`}>
            <option value="all">Todas</option>
            <option value="recibida">Recibida</option>
            <option value="en_reparacion">En reparación</option>
            <option value="lista">Lista para retirar</option>
            <option value="entregada">Entregada</option>
          </select>
        </div>
      </Card>

      {/* Listado */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            No hay órdenes que coincidan con la búsqueda.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((o) => (
              <li
                key={o.id}
                className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/40 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white">{o.orderNumber}</p>
                    <Badge tone={orderStatusTone(o.status)}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                    {o.customerName} · {(o.items || []).length} dispositivo(s) ·{' '}
                    {(o.items || []).filter((i) => i.status === 'terminado').length} listo(s)
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(o.createdAt)} · Recibió {o.receivedByName}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPrinting({ order: o, customer: customerOf(o) })}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Imprimir
                  </button>
                  <button
                    onClick={() => navigate(`/ordenes/${o.id}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700"
                  >
                    <Eye size={14} />
                    Ver
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <OrderForm open={formOpen} onClose={() => setFormOpen(false)} onCreated={(order) => setPrinting({ order, customer: customerOf(order) })} />
      <OrderPrint
        open={!!printing}
        order={printing?.order}
        customer={printing?.customer}
        onClose={() => setPrinting(null)}
      />
    </div>
  )
}