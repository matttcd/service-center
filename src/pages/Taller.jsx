// ============================================
// Taller: tablero del técnico (entrantes · en reparación).
// Los equipos listos viven en la página "Listos".
// ============================================
import { useMemo, useState } from 'react'
import { Inbox, ChevronDown } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { toTime } from '../utils/helpers.js'
import OrderCard from '../components/OrderCard.jsx'
import OrderModal from '../components/OrderModal.jsx'

const COLUMNS = [
  { key: 'entrantes', statuses: ['recibido'], title: 'Entrantes' },
  { key: 'taller', statuses: ['en_revision', 'en_reparacion'], title: 'En taller' },
  { key: 'presupuesto', statuses: ['presupuesto'], title: 'Presupuesto' },
]

function Column({ title, orders, onOpen, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="flex w-full flex-col md:flex-1 md:min-w-0">
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 transition hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 md:cursor-default md:hover:bg-slate-100 md:dark:hover:bg-slate-800"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">{title}</h3>
          <span className="rounded-full bg-white px-2.5 py-0.5 text-sm font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            {orders.length}
          </span>
        </div>
        <ChevronDown
          size={18}
          className={`text-slate-400 transition-transform md:hidden ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Contenido */}
      <div className={`flex flex-col ${open ? '' : 'hidden md:flex'} mt-2 md:mt-2`}>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 py-8 text-slate-300 dark:border-slate-800 dark:text-slate-600">
            <Inbox size={20} />
            <p className="text-xs">Vacío</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} onOpen={onOpen} />
            ))}
          </div>
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
        return toTime(last(b)) - toTime(last(a))
      })
    return COLUMNS.map((c, i) => ({
      ...c,
      orders: byLastActivity(orders.filter((o) => c.statuses.includes(o.status))),
      defaultOpen: i === 0,
    }))
  }, [orders])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Taller</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Equipos entrantes y en reparación · tocá una fila para ver la orden · los listos están en la página Listos
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:gap-4">
        {grouped.map((c) => (
          <Column key={c.key} title={c.title} orders={c.orders} onOpen={setSelected} defaultOpen={c.defaultOpen} />
        ))}
      </div>

      <OrderModal key={selected?.id || 'cerrado'} order={selected ? orders.find((o) => o.id === selected.id) : null} onClose={() => setSelected(null)} />
    </div>
  )
}
