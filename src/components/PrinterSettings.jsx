import { useNotify } from '../context/notifications.js'
import { useCallback, useEffect, useState } from 'react'
import { Printer, RefreshCw, Save } from 'lucide-react'
import { api } from '../utils/api.js'

export default function PrinterSettings() {
  const [data, setData] = useState(null)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const setNotice = useNotify('success')
  const load = useCallback(async () => {
    setBusy(true)
    try {
      const result = await api('/printing/config')
      setData(result)
      setForm(result.config)
      setNotice(result.error ? { error: true, text: result.error } : null)
    } catch (error) { setNotice({ error: true, text: error.message }) }
    finally { setBusy(false) }
  }, [setNotice])
  useEffect(() => { load() }, [load])
  const change = (key, value) => setForm((previous) => ({ ...previous, [key]: value }))
  const dirty = JSON.stringify(form) !== JSON.stringify(data?.config)
  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      const result = await api('/printing/config', { method: 'PUT', body: form })
      setData((previous) => ({ ...previous, config: result.config }))
      setForm(result.config)
      setNotice({ text: 'Impresoras guardadas para este local.' })
    } catch (error) { setNotice({ error: true, text: error.message }) }
    finally { setBusy(false) }
  }
  const test = async (kind) => {
    setBusy(true)
    setNotice(null)
    try {
      await api('/printing/test', { method: 'POST', body: { kind } })
      setNotice({ text: 'Prueba enviada a la cola de impresión. Verificá el papel antes de repetirla.' })
    } catch (error) { setNotice({ error: true, text: error.message }) }
    finally { setBusy(false) }
  }
  const inputClass = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white'
  const secondary = 'inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300'
  const picker = (key, title) => <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{title}
    <select className={inputClass} value={form[key]} onChange={(event) => change(key, event.target.value)} disabled={busy}>
      <option value="">Sin configurar</option>
      {form[key] && !data.printers.includes(form[key]) && <option value={form[key]}>{form[key]} · no disponible</option>}
      {data.printers.map((name) => <option key={name} value={name}>{name}</option>)}
    </select>
  </label>
  return <div className="max-w-2xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white"><Printer size={20} className="text-primary-500" />Impresoras del local</h2><p className="mt-1 text-sm text-slate-500">Elegí dónde enviar las órdenes y las etiquetas desde cualquier equipo del local.</p></div>
      <button type="button" disabled={busy} onClick={load} className={secondary}><RefreshCw size={15} />Actualizar lista</button>
    </div>
    {!form ? <p className="text-sm text-slate-500">{busy ? 'Buscando impresoras…' : 'Actualizá la lista para reintentar.'}</p> : <form onSubmit={save} className="space-y-6">
      <section className="space-y-3 border-b border-slate-200 pb-6 dark:border-slate-800">
        {picker('orderPrinter', 'Órdenes y comprobantes · A4')}
        <button type="button" onClick={() => test('order')} disabled={busy || dirty || !form.orderPrinter} className={secondary}>Imprimir prueba A4</button>
      </section>
      <section className="space-y-4">
        {picker('labelPrinter', 'Etiquetas de equipos')}
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Formato de etiqueta<select value={form.labelFormat} disabled={busy} onChange={(event) => change('labelFormat', event.target.value)} className={inputClass}><option value="pdf">PDF mediante el driver de la impresora</option><option value="zpl">ZPL · solo impresoras compatibles</option></select></label>
        {form.labelFormat === 'pdf' && <div className="grid grid-cols-2 gap-4">{[['labelWidthMm', 'Ancho (mm)'], ['labelHeightMm', 'Alto (mm)']].map(([key, label]) => <label key={key} className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}<input type="number" min="25" max="150" step="0.1" required disabled={busy} value={form[key]} onChange={(event) => change(key, event.target.value)} className={inputClass} /></label>)}</div>}
        <p className="text-sm text-slate-500">Usá las medidas del rollo y el mismo tamaño en las preferencias del driver. Las etiquetas PDF se envían al 100%.</p>
        <button type="button" onClick={() => test('label')} disabled={busy || dirty || !form.labelPrinter} className={secondary}>Imprimir etiqueta de prueba</button>
      </section>
      <div className="border-t border-slate-200 pt-5 dark:border-slate-800"><button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Save size={16} />{busy ? 'Procesando…' : 'Guardar impresoras'}</button>{dirty && <p className="mt-2 text-xs text-slate-500">Guardá los cambios antes de imprimir una prueba.</p>}</div>
      <p className="text-xs text-slate-500">Las impresoras deben estar instaladas en la PC servidora. {data.account && <>Cuenta de impresión: <strong>{data.account}</strong>. </>}Si falta una impresora compartida, revisá el acceso de esa cuenta en Windows.</p>
    </form>}
  </div>
}
