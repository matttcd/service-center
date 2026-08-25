// ============================================
// Dashboard: resumen del día con KPIs y pestañas por estado.
// ============================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Megaphone, FileText, CheckCircle2, Eye, Inbox, PackageX, DollarSign } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import Card from '../components/Card.jsx'
import { formatDate, titleCase, normalizeList } from '../utils/helpers.js'

const TABS = [
  { key: 'avisar', label: 'Sin avisar', Icon: Megaphone, tone: 'text-amber-500', emptyText: 'No hay equipos pendientes de avisar al cliente.' },
  { key: 'sin_presupuesto', label: 'Sin presupuesto', Icon: DollarSign, tone: 'text-amber-500', emptyText: 'No hay revisiones pendientes de presupuesto.' },
  { key: 'presupuestos', label: 'Pend. aprobación', Icon: FileText, tone: 'text-primary-500', emptyText: 'No hay presupuestos esperando confirmación del cliente.' },
  { key: 'falta_repuestos', label: 'Falta repuestos', Icon: PackageX, tone: 'text-orange-500', emptyText: 'No hay equipos esperando repuestos.' },
  { key: 'listos', label: 'Listos para retirar', Icon: CheckCircle2, tone: 'text-emerald-500', emptyText: 'No hay equipos terminados esperando retiro.' },
]

function KpiCard({ label, value, Icon, color }) {
  return (
    <Card className="flex items-center gap-4 px-5 py-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </Card>
  )
}

function QueueRow({ title, Icon, tone, items, emptyText }) {
  const navigate = useNavigate()
  return (
    <div>
      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((o) => (
            <li
              key={o.id}
              onClick={() => navigate(`/ordenes/${o.id}`)}
              className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 last:rounded-b-2xl dark:hover:bg-slate-800/40 sm:flex-row sm:items-center cursor-pointer"
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { pendingBudgetOrders, readyOrders, porAvisarOrders, faltaRepuestosOrders, ingresaronHoyOrders, presupuestoSinPrecioOrders } = useData()
  const [activeTab, setActiveTab] = useState('avisar')

  const counts = {
    avisar: porAvisarOrders.length,
    presupuestos: pendingBudgetOrders.length,
    listos: readyOrders.length,
    falta_repuestos: faltaRepuestosOrders.length,
    sin_presupuesto: presupuestoSinPrecioOrders.length,
  }

  const tabData = {
    avisar: porAvisarOrders,
    presupuestos: pendingBudgetOrders,
    listos: readyOrders,
    falta_repuestos: faltaRepuestosOrders,
    sin_presupuesto: presupuestoSinPrecioOrders,
  }

  const activeConfig = TABS.find((t) => t.key === activeTab)
  const activeItems = tabData[activeTab]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Resumen del día</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="Ingresaron hoy" value={ingresaronHoyOrders.length} Icon={Inbox} color="bg-slate-600" />
        <KpiCard label="Sin avisar" value={porAvisarOrders.length} Icon={Megaphone} color="bg-amber-500" />
        <KpiCard label="Sin presupuesto" value={presupuestoSinPrecioOrders.length} Icon={DollarSign} color="bg-amber-600" />
        <KpiCard label="Pend. aprobación" value={pendingBudgetOrders.length} Icon={FileText} color="bg-primary-600" />
        <KpiCard label="Falta repuestos" value={faltaRepuestosOrders.length} Icon={PackageX} color="bg-orange-500" />
      </div>

      {/* Tab bar */}
      <Card className="!p-0">
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition
                ${activeTab === tab.key
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
            >
              <tab.Icon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        <QueueRow
          title={activeConfig.label}
          Icon={activeConfig.Icon}
          tone={activeConfig.tone}
          items={activeItems}
          emptyText={activeConfig.emptyText}
        />
      </Card>
    </div>
  )
}
