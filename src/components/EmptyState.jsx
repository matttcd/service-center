// ============================================
// EmptyState: mensaje cuando no hay resultados
// ============================================
import { Inbox } from 'lucide-react'

export default function EmptyState({ message = 'Sin resultados', sub }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="rounded-2xl bg-slate-100 p-4 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Inbox size={28} />
      </div>
      <p className="font-medium text-slate-500 dark:text-slate-400">{message}</p>
      {sub && <p className="text-sm text-slate-400 dark:text-slate-500">{sub}</p>}
    </div>
  )
}
