// ============================================
// Settings: configuración general (solo admin)
// ============================================
import { useEffect, useState } from 'react'
import { Save, AlertCircle, CheckCircle2, Stethoscope, Upload, Plus, X, Package, MonitorSmartphone, Wrench } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import Card from '../components/Card.jsx'
import { formatMoney } from '../utils/helpers.js'
import { api } from '../utils/api.js'

// Editor genérico de una lista de opciones (chips editables).
function ListEditor({ title, icon, desc, items, onSave }) {
  const [list, setList] = useState(items || [])
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!dirty) setList(items || [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const addItem = () => {
    const v = draft.trim()
    if (!v) return
    if (!list.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setList((prev) => [...prev, v])
      setDirty(true)
    }
    setDraft('')
    setMsg(null)
  }

  const removeItem = (idx) => {
    setList((prev) => prev.filter((_, i) => i !== idx))
    setDirty(true)
    setMsg(null)
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    setMsg(null)
    const res = await onSave(list)
    if (res.error) {
      setMsg({ type: 'error', text: res.error })
    } else {
      setDirty(false)
      setMsg({ type: 'ok', text: 'Lista guardada.' })
    }
    setSaving(false)
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  return (
    <Card>
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          {icon}
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{desc}</p>
      </div>

      <div className="space-y-4 px-5 py-5">
        {msg && (
          <p className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            msg.type === 'ok'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
          }`}>
            {msg.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {msg.text}
          </p>
        )}

        {list.length === 0 ? (
          <p className="text-sm text-slate-400">Sin opciones cargadas todavía.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((item, i) => (
              <span
                key={`${item}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  title="Quitar"
                  className="rounded-full p-0.5 text-slate-400 transition hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/10"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
            placeholder="Nueva opción..."
            className={inputCls}
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!draft.trim()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            title="Agregar"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </Card>
  )
}

export default function Settings() {
  const { config, saveConfig, catalogLists, saveCatalogLists } = useData()
  const [revisionFee, setRevisionFee] = useState('')
  const [appliedFee, setAppliedFee] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  // Sincroniza con el valor guardado solo cuando cambió de verdad
  // (un refresh por SSE no debe pisar lo que estás escribiendo).
  useEffect(() => {
    if (!config) return
    const val = config.revisionFee ?? ''
    if (appliedFee === val) return
    setAppliedFee(val)
    setRevisionFee(String(val))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    const value = Number(revisionFee)
    if (Number.isNaN(value) || value < 0) return setNotice({ type: 'error', text: 'Ingresá un valor válido.' })
    setSaving(true)
    setNotice(null)
    const res = await saveConfig({ revisionFee: value })
    setNotice(
      res.error
        ? { type: 'error', text: res.error }
        : { type: 'ok', text: 'Costo de revisión guardado.' }
    )
    setSaving(false)
  }

  const handleImport = async () => {
    if (importing || !importText.trim()) return
    const lines = importText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    const models = lines.map((line) => {
      const sep = line.includes(',') ? ',' : line.includes('\t') ? '\t' : ' '
      const [brand, ...rest] = line.split(sep)
      return { brand: (brand || '').trim(), name: rest.join(' ').trim() }
    }).filter((m) => m.brand && m.name)
    if (models.length === 0) {
      setImportResult({ type: 'error', text: 'Formato inválido. Usá: Marca, Modelo (una línea por modelo).' })
      return
    }
    setImporting(true)
    setImportResult(null)
    try {
      const res = await api('/catalog/models/bulk', { method: 'POST', body: { models } })
      setImportResult({ type: 'ok', text: `Importados: ${res.created} nuevos. Duplicados omitidos: ${res.skipped}. Total en catálogo: ${res.total}.` })
      setImportText('')
    } catch (e) {
      setImportResult({ type: 'error', text: e.message || 'Error al importar.' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Opciones generales del sistema</p>
      </div>

      {notice && (
        <p
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            notice.type === 'ok'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
          }`}
        >
          {notice.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {notice.text}
        </p>
      )}

      <Card>
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <Stethoscope size={18} className="text-primary-500" />
            Costo de revisión
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Lo que se cobra cuando un cliente no acepta el presupuesto de un equipo que pasó por
            revisión técnica.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div className="max-w-xs">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Valor fijo ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={revisionFee}
              onChange={(e) => setRevisionFee(e.target.value)}
              placeholder="5000"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-400">
              Actual: <span className="font-semibold text-slate-600 dark:text-slate-300">{formatMoney(Number(revisionFee) || 0)}</span>
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <Upload size={18} className="text-primary-500" />
            Importar modelos al catálogo
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Cargá varios modelos de una. Un modelo por línea: <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">Marca, Modelo</code> o <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">Marca Modelo</code>.
          </p>
        </div>

        <div className="space-y-4 px-5 py-5">
          <textarea
            value={importText}
            onChange={(e) => { setImportText(e.target.value); setImportResult(null) }}
            placeholder={"Samsung Galaxy S26\nApple iPhone 17\nXiaomi Redmi Note 15\nMotorola Edge 60"}
            rows={8}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />

          {importResult && (
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${
              importResult.type === 'ok'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
            }`}>
              {importResult.text}
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {importText.split('\n').filter((l) => l.trim()).length} líneas detectadas
            </p>
            <button
              onClick={handleImport}
              disabled={importing || !importText.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
            >
              <Upload size={16} />
              {importing ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </div>
      </Card>

      <ListEditor
        title="Accesorios"
        icon={<Package size={18} className="text-primary-500" />}
        desc="Accesorios comunes que el cliente puede dejar junto al equipo."
        items={catalogLists.accessories}
        onSave={(list) => saveCatalogLists({ accessories: list })}
      />

      <ListEditor
        title="Estado del equipo"
        icon={<MonitorSmartphone size={18} className="text-primary-500" />}
        desc="Condiciones en las que puede ingresar el equipo."
        items={catalogLists.conditions}
        onSave={(list) => saveCatalogLists({ conditions: list })}
      />

      <ListEditor
        title="Arreglos"
        icon={<Wrench size={18} className="text-primary-500" />}
        desc="Reparaciones más comunes para cargar el diagnóstico."
        items={catalogLists.fixes}
        onSave={(list) => saveCatalogLists({ fixes: list })}
      />
    </div>
  )
}