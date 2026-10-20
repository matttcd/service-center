import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { NotificationContext } from '../context/notifications.js'

const tones = {
  success: 'border-emerald-200 bg-white text-emerald-800 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300',
  error: 'border-red-200 bg-white text-red-800 dark:border-red-800 dark:bg-slate-900 dark:text-red-300',
  info: 'border-sky-200 bg-white text-sky-800 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300',
}

function Notification({ item, dismiss }) {
  const [paused, setPaused] = useState(false)
  const [hidden, setHidden] = useState(document.hidden)
  useEffect(() => {
    const change = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', change)
    return () => document.removeEventListener('visibilitychange', change)
  }, [])
  useEffect(() => {
    // Los errores permanecen hasta cerrarlos o volver a intentar la operación.
    if (item.type === 'error' || paused || hidden) return
    const timer = window.setTimeout(() => dismiss(item.id), 7000)
    return () => window.clearTimeout(timer)
  }, [item.id, item.revision, item.type, dismiss, paused, hidden])
  const Icon = item.type === 'error' ? AlertCircle : item.type === 'success' ? CheckCircle2 : Info
  return <div data-notification={item.type} role={item.type === 'error' ? 'alert' : 'status'}
    className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl ${tones[item.type] || tones.info}`}
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}>
    <Icon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
    <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{item.message}</p>
      {item.onAction && <button type="button" onClick={item.onAction} className="mt-2 text-sm font-semibold underline underline-offset-2">{item.actionLabel || 'Reintentar'}</button>}
    </div>
    <button type="button" onClick={() => dismiss(item.id)} aria-label="Cerrar notificación" className="shrink-0 rounded-md p-1 opacity-70 transition hover:bg-slate-100 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-slate-800"><X size={17} /></button>
  </div>
}

export default function NotificationProvider({ children }) {
  const [items, setItems] = useState([])
  const sequence = useRef(0)
  const dismiss = useCallback((id) => setItems((previous) => previous.filter((item) => item.id !== id)), [])
  const show = useCallback((value, existingId) => {
    const id = existingId || `notification-${++sequence.current}`
    const revision = ++sequence.current
    setItems((previous) => [...previous.filter((item) => item.id !== id), { ...value, id, revision }].slice(-5))
    return id
  }, [])
  const context = useMemo(() => ({ show, dismiss }), [show, dismiss])
  return <NotificationContext.Provider value={context}>
    {children}
    {createPortal(<section aria-label="Notificaciones" className="pointer-events-none fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[10000] flex max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-y-auto sm:left-auto sm:right-5 sm:w-96">
      {items.map((item) => <Notification key={item.id} item={item} dismiss={dismiss} />)}
    </section>, document.body)}
  </NotificationContext.Provider>
}
