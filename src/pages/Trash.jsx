import { useCallback, useEffect, useState } from 'react'
import { RotateCcw, Trash2, Loader2 } from 'lucide-react'
import { api } from '../utils/api.js'
import { useData } from '../context/DataContext.jsx'
import { formatDateTime } from '../utils/helpers.js'
import Card from '../components/Card.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'

export default function Trash() {
  const { refresh, ordersRevision } = useData()
  const [tab, setTab] = useState('orders')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ orders: [], customers: [], orderCount: 0, customerCount: 0, limit: 50 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await api(`/trash?page=${page}`)); setError('') }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [page])
  useEffect(() => { load() }, [load, ordersRevision])
  const total = tab === 'orders' ? data.orderCount : data.customerCount
  const pages = Math.max(1, Math.ceil(total / data.limit))
  useEffect(() => { if (page > pages) setPage(pages) }, [page, pages])
  const restore = async () => {
    if (!target || busy) return
    setBusy(true)
    setError('')
    try {
      await api(`/trash/${tab}/${target.id}/restore`, { method: 'POST' })
      await refresh({ silent: true })
      setNotice(tab === 'orders' ? 'Orden restaurada con su historial.' : 'Cliente y órdenes asociadas restaurados.')
      await load()
    } catch (err) { setError(err.message) }
    finally { setBusy(false); setTarget(null) }
  }
  return <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Papelera</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">Recuperá clientes u órdenes eliminados por error. Se conservan durante 30 días y vuelven con su historial.</p>
    </div>
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200"><p>{error}</p><button onClick={load} className="font-semibold underline">Reintentar</button></div>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{notice}</p>}
    <div className="flex gap-2" aria-label="Tipo de elemento">
      {[['orders', 'Órdenes', data.orderCount], ['customers', 'Clientes', data.customerCount]].map(([key, label, count]) => <button key={key} aria-pressed={tab === key} onClick={() => { setTab(key); setPage(1); setNotice('') }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-primary-600 text-white' : 'border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>{label} ({count})</button>)}
    </div>
    <Card>
      {loading ? <p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Cargando papelera…</p> : data[tab].length === 0 ? <div className="flex flex-col items-center gap-2 p-10 text-center text-slate-500"><Trash2 size={24} /><p>No hay {tab === 'orders' ? 'órdenes' : 'clientes'} en la papelera.</p></div> : <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {data[tab].map((entry) => <li key={entry.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0"><p className="font-semibold text-slate-900 dark:text-white">{tab === 'orders' ? `${entry.orderNumber} · ${entry.brand} ${entry.model}` : entry.fullName}</p><p className="text-sm text-slate-500 dark:text-slate-400">{tab === 'orders' ? entry.customer.fullName : `DNI ${entry.dni || 'sin registrar'}`}</p><p className="mt-1 text-xs text-slate-500">Eliminado {formatDateTime(entry.deletedAt)}</p></div>
          <button disabled={busy} onClick={() => setTarget(entry)} className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border border-primary-300 px-3 py-2 text-sm font-semibold text-primary-700 disabled:opacity-50 dark:border-primary-700 dark:text-primary-300"><RotateCcw size={15} />Restaurar</button>
        </li>)}
      </ul>}
    </Card>
    {pages > 1 && <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300"><button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><span>Página {page} de {pages}</span><button disabled={page === pages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Siguiente</button></div>}
    <ConfirmModal open={!!target} onClose={() => setTarget(null)} onConfirm={restore} title="Restaurar elemento" confirmLabel="Restaurar" message={tab === 'orders' ? 'La orden volverá a su estado anterior con todo su historial. Si su cliente está eliminado, también se recuperará.' : 'El cliente y las órdenes eliminadas junto con él volverán a estar disponibles. Las órdenes que ya estaban eliminadas permanecerán en la papelera.'} />
  </div>
}
