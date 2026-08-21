// ============================================
// Listos: equipos terminados listos para entregar.
// ============================================
import { useMemo, useState } from 'react'
import { Inbox } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { toTime } from '../utils/helpers.js'
import OrderCard from '../components/OrderCard.jsx'
import OrderModal from '../components/OrderModal.jsx'

export default function Listos() {
  const { orders } = useData()
  const [selected, setSelected] = useState(null)

  const listos = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'terminado')
        .sort((a, b) => {
          const last = (o) => o.history?.[o.history.length - 1]?.at || o.createdAt
          return toTime(last(b)) - toTime(last(a))
        }),
    [orders],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Listos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Equipos terminados listos para entregar
        </p>
      </div>

      {listos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 py-12 text-slate-300 dark:border-slate-800 dark:text-slate-600">
          <Inbox size={24} />
          <p className="text-sm">No hay equipos listos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {listos.map((o) => (
            <OrderCard key={o.id} order={o} onOpen={setSelected} />
          ))}
        </div>
      )}

      <OrderModal key={selected?.id || 'cerrado'} order={selected ? orders.find((o) => o.id === selected.id) : null} onClose={() => setSelected(null)} />
    </div>
  )
}