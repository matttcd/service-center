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
import { ORDER_STATUS_LABEL } from '../utils/helpers.js'

const fmtTime = (iso) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })

const ICONS = {
  create: <Plus size={14} className="text-emerald-500" />,
  update: <Pencil size={14} className="text-sky-500" />,
  delete: <Trash2 size={14} className="text-red-500" />,
  status: <RefreshCw size={14} className="text-primary-500" />,
  whatsapp: <Send size={14} className="text-emerald-500" />,
  whatsapp_error: <MessageSquareWarning size={14} className="text-red-500" />,
  seed: <Upload size={14} className="text-slate-400" />,
  restore: <Archive size={14} className="text-sky-500" />,
  toggle: <RefreshCw size={14} className="text-accent-500" />,
  config: <Save size={14} className="text-accent-500" />,
  password_change: <RefreshCw size={14} className="text-accent-500" />,
  assign: <RefreshCw size={14} className="text-primary-500" />,
}

const DOT_COLORS = {
  create: 'bg-emerald-500',
  update: 'bg-sky-500',
  delete: 'bg-red-500',
  status: 'bg-primary-500',
  whatsapp: 'bg-emerald-500',
  whatsapp_error: 'bg-red-500',
  seed: 'bg-slate-400',
  restore: 'bg-sky-500',
  toggle: 'bg-accent-500',
  config: 'bg-accent-500',
  password_change: 'bg-accent-500',
  assign: 'bg-primary-500',
}

// Extrae el n.º de orden de los detalles (empieza con "OS-" o "Orden OS-").
const getOrderNum = (d) => {
  if (!d) return null
  const m = d.match(/^(?:Orden\s+)?(OS-\d+)/i)
  return m ? m[1] : null
}

// Extrae el nombre de cliente/usuario de los detalles.
const getEntityName = (d, prefix) => {
  if (!d) return null
  const m = d.match(new RegExp(`${prefix}\\s+(.+?)(?:\\s*\\(|$)`, 'i'))
  return m ? m[1].trim() : null
}

function formatSentence(event) {
  const { action, table, details } = event
  const orderNum = getOrderNum(details)

  // ---- Órdenes ----
  if (table === 'orders') {
    if (action === 'create') return `creó la orden ${orderNum || ''}`
    if (action === 'delete') return `eliminó la orden ${orderNum || ''}`
    if (action === 'status') {
      const m = details?.match(/estado\s+"([^"]+)"/i)
      const label = m ? (ORDER_STATUS_LABEL[m[1]] || m[1]) : ''
      return `cambió el estado de la orden ${orderNum || ''} a ${label}`
    }
    if (action === 'assign') {
      const m = details?.match(/asignado a\s+(.+)/i)
      const tech = m ? m[1].trim() : ''
      return `asignó la orden ${orderNum || ''} a ${tech}`
    }
    if (action === 'update') {
      if (details?.includes('marcado como avisado')) return `avisó al cliente de la orden ${orderNum || ''}`
      if (details?.includes('desmarcado como avisado')) return `desmarcó aviso de la orden ${orderNum || ''}`
      if (details?.includes('confirmado por el cliente')) return `confirmó el presupuesto de la orden ${orderNum || ''}`
      if (details?.includes('desmarcado como confirmado')) return `desconfirmó el presupuesto de la orden ${orderNum || ''}`
      if (details?.includes('notas/presupuesto')) return `editó la orden ${orderNum || ''}`
      return `editó la orden ${orderNum || ''}`
    }
  }

  // ---- Clientes ----
  if (table === 'customers') {
    const name = getEntityName(details, 'cliente') || details
    if (action === 'create') return `creó al cliente ${name}`
    if (action === 'delete') return `eliminó al cliente ${name}`
    if (action === 'update') return `editó al cliente ${name}`
  }

  // ---- Usuarios ----
  if (table === 'users') {
    const name = getEntityName(details, 'usuario') || getEntityName(details, 'Usuario') || details
    if (action === 'create') return `creó al usuario ${name}`
    if (action === 'toggle') return `${details?.includes('activado') ? 'activó' : 'desactivó'} al usuario ${name}`
  }

  // ---- Catálogo ----
  if (table === 'catalog') {
    return details || 'actualizó el catálogo'
  }

  // ---- Config ----
  if (table === 'config' || action === 'config') {
    return 'actualizó la configuración'
  }

  // ---- Contraseña ----
  if (action === 'password_change') {
    const name = details?.match(/\((.+)\)/)?.[1] || '—'
    return `cambió la contraseña de ${name}`
  }

  // ---- WhatsApp ----
  if (action === 'whatsapp') return 'envió un WhatsApp'
  if (action === 'whatsapp_error') return 'falló un envío de WhatsApp'

  // ---- Sistema ----
  if (action === 'seed') return 'inicializó el sistema'
  if (action === 'restore') return 'restauró datos'

  // ---- Fallback ----
  return details || action
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
          <ol className="px-5 py-4">
            {actividad.map((event, i) => (
              <li key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT_COLORS[event.action] || 'bg-slate-400'}`} />
                  {i < actividad.length - 1 && <span className="w-px flex-1 bg-slate-200 dark:bg-slate-700" />}
                </div>
                <div className="min-w-0 flex-1 pb-4">
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    <span className="font-semibold">{event.userName || '—'}</span>
                    {' '}
                    <span className="text-slate-500 dark:text-slate-400">{formatSentence(event)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{fmtTime(event.timestamp)}</p>
                </div>
              </li>
            ))}
          </ol>
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
