// ============================================
// DashboardCards: tarjetas de métricas principales
// ============================================
import { Inbox, Stethoscope, FileText, Wrench, CheckCircle2, PackageCheck } from 'lucide-react'
import StatCard from './StatCard.jsx'

export default function DashboardCards({ metrics }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        icon={Inbox}
        label="Recibidos hoy"
        value={metrics.receivedToday}
        sub="Órdenes creadas en el día"
        accent="primary"
      />
      <StatCard
        icon={Stethoscope}
        label="En revisión"
        value={metrics.inRevisionCount}
        sub="Equipos que revisa el técnico"
        accent="primary"
      />
      <StatCard
        icon={FileText}
        label="Presupuesto pendiente"
        value={metrics.pendingBudgetCount}
        sub="Esperando decisión del cliente"
        accent="amber"
      />
      <StatCard
        icon={Wrench}
        label="En reparación"
        value={metrics.inRepairCount}
        sub="Trabajo en curso"
        accent="primary"
      />
      <StatCard
        icon={CheckCircle2}
        label="Listos para retirar"
        value={metrics.readyCount}
        sub="Equipos terminados sin entregar"
        accent="emerald"
      />
      <StatCard
        icon={PackageCheck}
        label="Entregados hoy"
        value={metrics.deliveredToday}
        sub="Equipos retirados en el día"
        accent="amber"
      />
    </div>
  )
}