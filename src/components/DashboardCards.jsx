// ============================================
// DashboardCards: tarjetas de métricas principales
// ============================================
import { ClipboardList, Wrench, CheckCircle2, PackageCheck } from 'lucide-react'
import StatCard from './StatCard.jsx'

export default function DashboardCards({ metrics }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={ClipboardList}
        label="Recibidos hoy"
        value={metrics.receivedToday}
        sub="Órdenes creadas en el día"
        accent="primary"
      />
      <StatCard
        icon={Wrench}
        label="En reparación"
        value={metrics.inRepairCount}
        sub="Órdenes con trabajo en curso"
        accent="amber"
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