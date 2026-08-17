// ============================================
// OrderDetail: detalle de una orden + acciones
// por equipo (reparación, entrega, etiqueta, WhatsApp)
// ============================================
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Printer,
  Send,
  Sticker,
  Trash2,
  Play,
  CheckCircle2,
  PackageCheck,
  RotateCcw,
  Save,
  Phone,
} from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import OrderPrint from '../components/OrderPrint.jsx'
import {
  orderStatus,
  ORDER_STATUS_LABEL,
  orderStatusTone,
  ITEM_STATUS_LABEL,
  itemStatusTone,
  formatDate,
  formatDateTime,
  formatMoney,
} from '../utils/helpers.js'

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { orders, customers, setItemStatus, updateItem, printItemLabel, notifyItem, deleteOrder } = useData()
  const [printing, setPrinting] = useState(false)
  const [busy, setBusy] = useState(null) // 'start' | 'finish' | 'deliver' | itemId
  const [notice, setNotice] = useState('')
  const [drafts, setDrafts] = useState({})

  const order = orders.find((o) => o.id === id)
  const customer = customers.find((c) => c.id === order?.customerId)
  const role = currentUser?.role
  const isTech = role === 'tecnico' || role === 'admin'
  const isCounter = role === 'mostrador' || role === 'admin'

  useEffect(() => {
    if (!order) return
    const initial = {}
    for (const it of order.items || []) initial[it.id] = { technicianNotes: it.technicianNotes || '', priceEstimate: it.priceEstimate || '' }
    setDrafts((d) => (Object.keys(d).length ? d : initial))
  }, [order])

  if (!order) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-slate-400">Orden no encontrada.</p>
        <button
          onClick={() => navigate('/ordenes')}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <ArrowLeft size={16} />
          Volver a órdenes
        </button>
      </div>
    )
  }

  const status = orderStatus(order)
  const items = order.items || []

  const showNotice = (msg) => {
    setNotice(msg)
    if (msg) window.setTimeout(() => setNotice(''), 5000)
  }

  const doStatus = async (item, next) => {
    setBusy(item.id)
    setNotice('')
    try {
      const res = await setItemStatus(order.id, item.id, next)
      if (res.error) return showNotice(res.error)
      if (next === 'terminado' && res.whatsapp && !res.whatsapp.sent) {
        showNotice('Equipo listo. El aviso de WhatsApp no se pudo enviar (revisá Configuración).')
      } else if (next === 'terminado') {
        showNotice('Equipo marcado como terminado y aviso enviado al cliente por WhatsApp.')
      } else {
        showNotice('Estado actualizado.')
      }
    } finally {
      setBusy(null)
    }
  }

  const doBatch = async (from, to) => {
    const targets = items.filter((i) => i.status === from)
    setBusy('batch')
    setNotice('')
    for (const item of targets) {
      const res = await setItemStatus(order.id, item.id, to)
      if (res.error) {
        showNotice(res.error)
        break
      }
    }
    showNotice(`${targets.length} equipo(s) actualizado(s).`)
    setBusy(null)
  }

  const saveNotes = async (itemId) => {
    setBusy('notes-' + itemId)
    const res = await updateItem(order.id, itemId, {
      technicianNotes: drafts[itemId]?.technicianNotes || '',
      priceEstimate: Number(drafts[itemId]?.priceEstimate) || 0,
    })
    showNotice(res.error ? res.error : 'Notas guardadas.')
    setBusy(null)
  }

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar la orden ${order.orderNumber}? Esta acción es reversible desde las copias de seguridad.`)) return
    const res = await deleteOrder(order.id)
    showNotice(res.error ? res.error : 'Orden eliminada.')
    if (!res.error) navigate('/ordenes')
  }

  const btnPrimary =
    'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50'
  const btnGhost =
    'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  const canStart = isTech
  const canFinish = isTech
  const canDeliver = isCounter
  const allRecibido = items.length > 1 && items.every((i) => i.status === 'recibido')
  const allInRepair = items.length > 1 && items.every((i) => i.status === 'en_reparacion')

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/ordenes')}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft size={16} />
        Volver a órdenes
      </button>

      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{order.orderNumber}</h1>
              <Badge tone={orderStatusTone(status)}>{ORDER_STATUS_LABEL[status]}</Badge>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {customer?.fullName || order.customerName} · DNI {customer?.dni || '—'} ·{' '}
              {formatDate(order.createdAt)} · Recibió {order.receivedByName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPrinting(true)} className={btnPrimary}>
            <Printer size={14} />
            Imprimir orden
          </button>
          <button onClick={handleDelete} className={`${btnGhost} !text-red-500 hover:!bg-red-50 dark:hover:!bg-red-500/10`}>
            <Trash2 size={14} />
            Eliminar
          </button>
        </div>
      </div>

      {notice && (
        <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
          {notice}
        </p>
      )}

      {/* Acciones por lotes */}
      {(allRecibido || allInRepair) && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-slate-600 dark:text-slate-300">
            La orden tiene {items.length} equipos. Podés avanzar todos juntos:
          </p>
          {allRecibido && canStart && (
            <button onClick={() => doBatch('recibido', 'en_reparacion')} disabled={busy === 'batch'} className={btnPrimary}>
              <Play size={14} />
              Iniciar reparación de todos
            </button>
          )}
          {allInRepair && canFinish && (
            <button onClick={() => doBatch('en_reparacion', 'terminado')} disabled={busy === 'batch'} className={btnPrimary}>
              <CheckCircle2 size={14} />
              Marcar todos terminados
            </button>
          )}
        </Card>
      )}

      {/* Datos del cliente */}
      <Card>
        <div className="grid grid-cols-1 gap-3 px-5 py-4 text-sm sm:grid-cols-3">
          <p className="text-slate-600 dark:text-slate-300">
            <span className="text-slate-400">Teléfonos:</span>{' '}
            {customer?.phone || '—'} {customer?.phone2 ? `· ${customer.phone2}` : ''}
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            <span className="text-slate-400">Email:</span> {customer?.email || '—'}
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            <span className="text-slate-400">Dirección:</span> {customer?.address || '—'}
          </p>
        </div>
      </Card>

      {/* Equipos */}
      <div className="space-y-4">
        {items.map((it) => {
          const draft = drafts[it.id] || { technicianNotes: '', priceEstimate: '' }
          return (
            <Card key={it.id} className="overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {it.brand} {it.model}
                    </p>
                    <Badge tone={itemStatusTone(it.status)}>{ITEM_STATUS_LABEL[it.status]}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    IMEI {it.imei || '—'}
                    {it.password ? ` · Clave: ${it.password}` : ''}
                  </p>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Costo {formatMoney(it.priceEstimate)} · Seña {formatMoney(it.advance)}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-2">
                <div className="space-y-2 text-sm">
                  <p className="text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Problema reportado:</span>{' '}
                    {it.issueDescription || '—'}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Accesorios:</span> {it.accessories || '—'}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400">Técnico:</span> {it.repairedByName || '—'}
                  </p>
                  {it.deliveredAt && (
                    <p className="text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Entregado:</span> {formatDate(it.deliveredAt)}
                    </p>
                  )}
                </div>

                {/* Notas del técnico */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Notas del técnico / precio final
                  </label>
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={draft.technicianNotes}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [it.id]: { ...d[it.id], technicianNotes: e.target.value } }))
                      }
                      rows={3}
                      placeholder="Reparación realizada, repuestos, observaciones..."
                      className={inputCls}
                      disabled={!isTech}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.priceEstimate}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [it.id]: { ...d[it.id], priceEstimate: e.target.value } }))
                        }
                        placeholder="Precio final ($)"
                        className={`${inputCls} w-40`}
                        disabled={!isTech}
                      />
                      {isTech && (
                        <button onClick={() => saveNotes(it.id)} disabled={busy === 'notes-' + it.id} className={btnPrimary}>
                          <Save size={14} />
                          Guardar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Acciones del equipo */}
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
                {it.status === 'recibido' && canStart && (
                  <button onClick={() => doStatus(it, 'en_reparacion')} disabled={busy === it.id} className={btnPrimary}>
                    <Play size={14} />
                    Iniciar reparación
                  </button>
                )}
                {it.status === 'en_reparacion' && canFinish && (
                  <button onClick={() => doStatus(it, 'terminado')} disabled={busy === it.id} className={btnPrimary}>
                    <CheckCircle2 size={14} />
                    Marcar terminado
                  </button>
                )}
                {it.status === 'terminado' && (
                  <>
                    {canDeliver && (
                      <button onClick={() => doStatus(it, 'entregado')} disabled={busy === it.id} className={btnPrimary}>
                        <PackageCheck size={14} />
                        Entregar al cliente
                      </button>
                    )}
                    {isTech && (
                      <button
                        onClick={() => doStatus(it, 'en_reparacion')}
                        disabled={busy === it.id}
                        className={btnGhost}
                      >
                        <RotateCcw size={14} />
                        Volver a reparación
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        const res = await printItemLabel(order.id, it.id)
                        showNotice(res.error ? res.error : 'Etiqueta enviada a la impresora.')
                      }}
                      className={btnGhost}
                    >
                      <Sticker size={14} />
                      Imprimir etiqueta
                    </button>
                    <button
                      onClick={async () => {
                        const res = await notifyItem(order.id, it.id)
                        showNotice(res.error ? res.error : 'Aviso de WhatsApp reenviado al cliente.')
                      }}
                      className={btnGhost}
                    >
                      <Send size={14} />
                      Reenviar WhatsApp
                    </button>
                  </>
                )}
                {it.status === 'entregado' && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                    <Phone size={14} />
                    Entregado al cliente
                  </span>
                )}
              </div>

              {/* Historial del equipo */}
              {(it.history || []).length > 0 && (
                <div className="border-t border-slate-200 bg-slate-50/60 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/30">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Historial
                  </p>
                  <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {(it.history || []).map((h, idx) => (
                      <li key={idx}>
                        <span className="font-semibold">
                          {h.status === 'whatsapp' ? 'WhatsApp' : ITEM_STATUS_LABEL[h.status] || h.status}:
                        </span>{' '}
                        {h.note || h.status} · {formatDateTime(h.at)} · {h.byName || '—'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <OrderPrint open={printing} order={order} customer={customer} onClose={() => setPrinting(false)} />
    </div>
  )
}