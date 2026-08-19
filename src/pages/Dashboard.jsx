// ============================================
// Dashboard: métricas + presupuestos pendientes y listos para retirar
// ============================================
import { useNavigate } from 'react-router-dom'
import { FileText, CheckCircle2, Bell, BellOff, Eye, Sticker } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import DashboardCards from '../components/DashboardCards.jsx'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { ORDER_STATUS_LABEL, orderStatusTone, formatDate } from '../utils/helpers.js'

function QueueRow({ title, Icon, tone, items, emptyText, showLabel, onNotify, onLabel }) {
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
                    {o.brand} {o.model}
                  </p>
                  <span className="text-xs text-slate-400">{o.orderNumber} · {o.customerName}</span>
                  {o.notified ? (
                    <Badge tone="green">
                      <Bell size={12} />
                      Avisado
                    </Badge>
                  ) : (
                    <Badge tone="yellow">
                      <BellOff size={12} />
                      Sin avisar
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-400">
                  {o.fix ? `${o.fix} · ` : ''}Recibido {formatDate(o.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {showLabel && (
                  <Badge tone={orderStatusTone(o.status)}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                )}
                <button
                  onClick={() => onNotify(o)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    o.notified
                      ? 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300'
                      : 'border-primary-200 bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {o.notified ? 'Desmarcar avisado' : 'Marcar avisado'}
                </button>
                {onLabel && (
                  <button
                    onClick={() => onLabel(o)}
                    title="Imprimir etiqueta"
                    className="rounded-lg border border-slate-300 p-1.5 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Sticker size={14} />
                  </button>
                )}
                <NavButton o={o} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function NavButton({ o }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/ordenes/${o.id}`)}
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700"
    >
      <Eye size={14} />
      Ver
    </button>
  )
}

export default function Dashboard() {
  const { metrics, pendingBudgetOrders, readyOrders, toggleNotified, printLabel } = useData()

  const handleNotify = async (o) => {
    const res = await toggleNotified(o.id, !o.notified)
    if (res.error) alert(res.error)
  }

  const handleLabel = async (o) => {
    const res = await printLabel(o.id)
    if (res.error) alert(res.error)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Resumen del día</p>
      </div>

      <DashboardCards metrics={metrics} />

      <QueueRow
        title="Presupuestos pendientes"
        icon={FileText}
        Icon={FileText}
        tone="text-accent-500"
        items={pendingBudgetOrders}
        emptyText="No hay presupuestos esperando confirmación del cliente."
        onNotify={handleNotify}
      />

      <QueueRow
        title="Listos para retirar"
        icon={CheckCircle2}
        Icon={CheckCircle2}
        tone="text-emerald-500"
        items={readyOrders}
        emptyText="No hay equipos terminados esperando retiro."
        onNotify={handleNotify}
        onLabel={handleLabel}
      />
    </div>
  )
}