// ============================================
// Backups: copias de seguridad y rollback (admin)
// ============================================
import { useCallback, useEffect, useState } from 'react'
import { Database, Plus, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { api } from '../utils/api.js'
import { useData } from '../context/DataContext.jsx'
import Card from '../components/Card.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'

const fmtSize = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`)

const fmtDate = (iso) =>
  new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })

export default function Backups() {
  const { refresh } = useData()
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [toRestore, setToRestore] = useState(null)
  const [restoring, setRestoring] = useState(false)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api('/backups')
      setBackups(res.backups || [])
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const createNow = async () => {
    setCreating(true)
    setNotice(null)
    try {
      await api('/backups', { method: 'POST' })
      setNotice({ type: 'ok', text: 'Copia de seguridad creada.' })
      await load()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setCreating(false)
    }
  }

  const confirmRestore = async () => {
    if (!toRestore) return
    setRestoring(true)
    setNotice(null)
    try {
      await api(`/backups/${encodeURIComponent(toRestore.name)}/restore`, { method: 'POST' })
      await refresh({ silent: true })
      setNotice({ type: 'ok', text: 'Copia restaurada. Los datos se actualizaron.' })
      setToRestore(null)
      await load()
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
    } finally {
      setRestoring(false)
    }
  }

  const btnPrimary =
    'inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Copias de seguridad</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Se hace una copia automática todos los días y una al iniciar el servidor. Acá podés
            restaurar una anterior (rollback).
          </p>
        </div>
        <button type="button" onClick={createNow} disabled={creating} className={btnPrimary}>
          <Plus size={16} />
          {creating ? 'Creando…' : 'Crear copia ahora'}
        </button>
      </div>

      {notice && (
        <p
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            notice.type === 'ok'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
          }`}
        >
          {notice.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {notice.text}
        </p>
      )}

      {loading ? (
        <Card className="p-6 text-center text-sm text-slate-400">Cargando copias…</Card>
      ) : backups.length === 0 ? (
        <Card>
          <EmptyState
            message="Todavía no hay copias de seguridad"
            sub="Se creará una automáticamente al iniciar el servidor o podés hacer una ahora."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {backups.map((b) => (
              <div
                key={b.name}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-500/15 dark:text-primary-400">
                    <Database size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{fmtDate(b.mtime)}</p>
                    <p className="text-xs text-slate-400">{fmtSize(b.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setToRestore(b)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-accent-200 px-3 py-2 text-sm font-semibold text-accent-600 transition hover:bg-accent-50 dark:border-accent-500/30 dark:hover:bg-accent-500/10"
                >
                  <RotateCcw size={15} />
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Confirmación de restauración */}
      <Modal open={!!toRestore} onClose={() => setToRestore(null)} title="Restaurar copia de seguridad">
        {toRestore && (
          <div className="space-y-4">
            <p className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent-500" />
              <span className="flex-1">
                ¿Seguro que querés restaurar la copia del{' '}
                <span className="whitespace-nowrap font-semibold">{fmtDate(toRestore.mtime)}</span>? Se
                reemplazarán las órdenes de servicio actuales. Antes de restaurar se
                crea una copia de seguridad del estado actual para poder deshacer.
              </span>
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setToRestore(null)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRestore}
                disabled={restoring}
                className="flex-1 rounded-lg bg-accent-500 px-4 py-2.5 font-semibold text-white transition hover:bg-accent-600 disabled:opacity-50"
              >
                {restoring ? 'Restaurando…' : 'Sí, restaurar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}