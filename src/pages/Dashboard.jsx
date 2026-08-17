// ============================================
// Dashboard: métricas y equipos listos para retirar
// ============================================
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Send, Printer } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import DashboardCards from '../components/DashboardCards.jsx'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { ITEM_STATUS_LABEL } from '../utils/helpers.js'

export default function Dashboard() {
  const { metrics, readyItems, printItemLabel, notifyItem } = useData()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Resumen del día</p>
      </div>

      <DashboardCards metrics={metrics} />

      {/* Equipos listos para retirar */}
      <Card>
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <CheckCircle2 size={18} className="text-emerald-500" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Listos para retirar</h2>
          <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            {readyItems.length}
          </span>
        </div>

        {readyItems.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            No hay equipos terminados esperando retiro.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {readyItems.map(({ order, item }) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/40 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">
                    {item.brand} {item.model}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {order.orderNumber} · {order.customerName}
                    </span>
                  </p>
                  <p className="text-sm text-slate-400">
                    IMEI {item.imei || '—'} · {order.orderNumber}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge tone="green">{ITEM_STATUS_LABEL[item.status]}</Badge>
                  <button
                    onClick={() => navigate(`/ordenes/${order.id}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700"
                  >
                    Ver
                  </button>
                  <button
                    onClick={async () => {
                      const res = await notifyItem(order.id, item.id)
                      if (res.error) alert(res.error)
                    }}
                    title="Reenviar aviso de WhatsApp al cliente"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 p-1.5 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Send size={14} />
                  </button>
                  <button
                    onClick={async () => {
                      const res = await printItemLabel(order.id, item.id)
                      if (res.error) alert(res.error)
                    }}
                    title="Imprimir etiqueta"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 p-1.5 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Printer size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}