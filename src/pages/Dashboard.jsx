// ============================================
// Dashboard: métricas + listas de acceso rápido.
// Cada fila tiene un único botón "Ver" que lleva a la vista detallada
// (todas las acciones viven en OrderDetail / OrderModal).
// ============================================
import { useNavigate } from 'react-router-dom'
import { Megaphone, FileText, CheckCircle2, Eye } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import Card from '../components/Card.jsx'
import { formatDate, titleCase, normalizeList } from '../utils/helpers.js'

function QueueRow({ title, Icon, tone, items, emptyText }) {
  const navigate = useNavigate()
  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <Icon size={18} className={tone} />
        <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((o) => (
            <li
              key={o.id}
              className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/40 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {titleCase(o.brand)} {titleCase(o.model)}
                  </p>
                  <span className="text-xs text-slate-400">{o.orderNumber} · {titleCase(o.customerName)}</span>
                </div>
                <p className="text-sm text-slate-400">
                  {o.fix ? `${normalizeList(o.fix)} · ` : ''}Recibido {formatDate(o.createdAt)}
                </p>
              </div>

              <button
                onClick={() => navigate(`/ordenes/${o.id}`)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700"
              >
                <Eye size={14} />
                Ver
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default function Dashboard() {
  const { pendingBudgetOrders, readyOrders, porAvisarOrders } = useData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Resumen del día</p>
      </div>

      <QueueRow
        title="Por avisar"
        Icon={Megaphone}
        tone="text-amber-500"
        items={porAvisarOrders}
        emptyText="No hay equipos pendientes de avisar al cliente."
      />

      <QueueRow
        title="Presupuestos pendientes"
        Icon={FileText}
        tone="text-accent-500"
        items={pendingBudgetOrders}
        emptyText="No hay presupuestos esperando confirmación del cliente."
      />

      <QueueRow
        title="Listos para retirar"
        Icon={CheckCircle2}
        tone="text-emerald-500"
        items={readyOrders}
        emptyText="No hay equipos terminados esperando retiro."
      />
    </div>
  )
}