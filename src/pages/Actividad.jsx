// ============================================
// Actividad: línea de tiempo de movimientos del sistema
// ============================================
import {
  History,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Send,
  MessageSquareWarning,
  Upload,
  Archive,
  Save,
} from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import Card from '../components/Card.jsx'
import EmptyState from '../components/EmptyState.jsx'

const fmtTime = (iso) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })

const ICONS = {
  create: <Plus size={16} className="text-primary-500" />,
  update: <Pencil size={16} className="text-sky-500" />,
  delete: <Trash2 size={16} className="text-red-500" />,
  status: <RefreshCw size={16} className="text-primary-500" />,
  whatsapp: <Send size={16} className="text-emerald-500" />,
  whatsapp_error: <MessageSquareWarning size={16} className="text-red-500" />,
  seed: <Upload size={16} className="text-slate-400" />,
  restore: <Archive size={16} className="text-sky-500" />,
  toggle: <RefreshCw size={16} className="text-accent-500" />,
  config: <Save size={16} className="text-accent-500" />,
  password_change: <RefreshCw size={16} className="text-accent-500" />,
}

const LABELS = {
  create: 'Creación',
  update: 'Edición',
  delete: 'Baja',
  status: 'Estado',
  whatsapp: 'WhatsApp',
  whatsapp_error: 'WhatsApp falló',
  seed: 'Inicialización',
  restore: 'Restauración',
  toggle: 'Estado usuario',
  config: 'Configuración',
  password_change: 'Contraseña',
}

export default function Actividad() {
  const { actividad, actividadHasMore, loadMoreActividad, actividadError } = useData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Actividad</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Línea de tiempo de las acciones registradas en el sistema.
        </p>
      </div>

      {actividad.length === 0 ? (
        <Card>
          {actividadError ? (
            <p className="px-5 py-10 text-center text-sm text-red-600 dark:text-red-400">{actividadError}</p>
          ) : (
            <EmptyState
              message="Todavía no hay movimientos"
              sub="Cuando registres órdenes o cambios de estado van a aparecer acá."
            />
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <History size={18} className="text-primary-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Línea de tiempo</h2>
            <span className="ml-auto text-xs text-slate-400">Guardado {fmtTime(actividad[0].timestamp)}</span>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {actividad.map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 shrink-0">{ICONS[event.action] || <History size={16} className="text-slate-400" />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {LABELS[event.action] || event.action}
                    </p>
                    <p className="truncate text-sm text-slate-400">{event.details || '—'}</p>
                  </div>
                </div>
                <p className="whitespace-nowrap text-xs text-slate-400 sm:text-right">
                  {event.userName || '—'} · {fmtTime(event.timestamp)}
                </p>
              </div>
            ))}
          </div>
          {actividadHasMore && (
            <div className="border-t border-slate-200 px-5 py-3 dark:border-slate-800">
              <button
                type="button"
                onClick={loadMoreActividad}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Ver más movimientos
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}