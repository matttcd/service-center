// ============================================
// Taller: tablero del técnico (entrantes · en reparación).
// Los equipos listos viven en la página "Listos".
// ============================================
import { useMemo, useState } from 'react'
import { Inbox } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import OrderCard from '../components/OrderCard.jsx'
import OrderModal from '../components/OrderModal.jsx'

const COLUMNS = [
  { key: 'entrantes', statuses: ['recibido', 'en_revision', 'presupuesto'], title: 'Entrantes' },
  { key: 'reparacion', statuses: ['en_reparacion'], title: 'En reparación' },
]

function Column({ title, orders, onOpen }) {
  return (
    <div className="flex w-full flex-col gap-2 md:w-80 md:shrink-0">
      <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
        <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">{title}</h3>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          {orders.length}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 py-10 text-slate-300 dark:border-slate-800 dark:text-slate-600">
            <Inbox size={24} />
            <p className="text-sm">Vacío</p>
          </div>
        ) : (
          orders.map((o) => <OrderCard key={o.id} order={o} onOpen={onOpen} />)
        )}
      </div>
    </div>
  )
}

export default function Taller() {
  const { orders } = useData()
  const [selected, setSelected] = useState(null)

  const grouped = useMemo(() => {
    const byLastActivity = (list) =>
      [...list].sort((a, b) => {
        const last = (o) => o.history?.[o.history.length - 1]?.at || o.createdAt
        return String(last(b)).localeCompare(String(last(a)))
      })
    return COLUMNS.map((c) => ({
      ...c,
      orders: byLastActivity(orders.filter((o) => c.statuses.includes(o.status))),
    }))
  }, [orders])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Taller</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Equipos entrantes y en reparación · tocá una card para ver la orden · los listos están en la página Listos
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-start">
        {grouped.map((c) => (
          <Column key={c.key} title={c.title} orders={c.orders} onOpen={setSelected} />
        ))}
      </div>

      <OrderModal order={selected ? orders.find((o) => o.id === selected.id) : null} onClose={() => setSelected(null)} />
    </div>
  )
}