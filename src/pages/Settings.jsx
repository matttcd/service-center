// ============================================
// Settings: configuración general (solo admin)
// Rediseño unificado con pestañas estilo Dashboard
// ============================================
import { useNotify } from '../context/notifications.js'
import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Save,
  AlertCircle,
  Stethoscope,
  Upload,
  Plus,
  X,
  Package,
  MonitorSmartphone,
  Wrench,
  FileText,
  Users,
  Sliders,
  Tags,
  Search,
  Eye,
  EyeOff,
  Sparkles,
  Trash2,
  HelpCircle,
  Printer,
} from 'lucide-react'
import PrinterSettings from '../components/PrinterSettings.jsx'
import { useData } from '../context/DataContext.jsx'
import Card from '../components/Card.jsx'
import {
  formatMoney,
  calculateTermsTotal,
  parseBulkModels,
  termsTextToClauses,
  clausesToTermsText,
} from '../utils/helpers.js'
import { api } from '../utils/api.js'

const MAX_TERMS_CHARS = 1600

const SAMPLE_MODELS = `Samsung, Galaxy A15 5G
Samsung, Galaxy A25 5G
Samsung, Galaxy A35 5G
Samsung, Galaxy A55 5G
Samsung, Galaxy S24 Ultra
Apple, iPhone 13
Apple, iPhone 14
Apple, iPhone 15 Pro
Motorola, Moto G24
Motorola, Moto G54 5G
Motorola, Edge 50 Pro
Xiaomi, Redmi 13C
Xiaomi, Redmi Note 13 Pro`

const DEFAULT_TERMS_SAMPLE = [
  'Para la entrega del equipo, el cliente o un tercero asignado deberán presentar la orden. Si es un tercero, deberá contar con una autorización explícita del titular. Sin la orden original no se reconocerá garantía alguna.',
  'La garantía tiene una duración de treinta (30) días corridos desde el retiro y cubre exclusivamente las reparaciones detalladas en la presente orden.',
  'Transcurridos treinta (30) días desde la notificación de que el equipo está listo sin que haya sido retirado, El Gringo Celulares se reserva el derecho de modificar el presupuesto debido a variaciones en los costos de repuestos.',
  'Los pagos son exclusivamente en efectivo.',
  'Para cualquier duda o consulta sobre el estado de su dispositivo comunicarse al 3704-583266 o al 3704-676320.',
  'Declaro haber leído y acepto las condiciones precedentemente descriptas.',
]

// ----------------------------------------------------
// 1. Pestaña General: Tarifa de revisión técnica
// ----------------------------------------------------
function GeneralSection({ config, saveConfig }) {
  const [revisionFee, setRevisionFee] = useState('')
  const [appliedFee, setAppliedFee] = useState(null)
  const [saving, setSaving] = useState(false)
  const setNotice = useNotify('success')

  useEffect(() => {
    if (!config) return
    const val = config.revisionFee ?? ''
    if (appliedFee === val) return
    setAppliedFee(val)
    setRevisionFee(String(val))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    const value = Number(revisionFee)
    if (Number.isNaN(value) || value < 0) {
      return setNotice({ type: 'error', text: 'Ingresá un valor numérico válido.' })
    }
    setSaving(true)
    setNotice(null)
    const res = await saveConfig({ revisionFee: value })
    setNotice(
      res.error
        ? { type: 'error', text: res.error }
        : { type: 'ok', text: 'Costo de revisión técnica guardado con éxito.' }
    )
    setSaving(false)
  }

  const addPreset = (delta) => {
    const current = Number(revisionFee) || 0
    setRevisionFee(String(Math.max(0, current + delta)))
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Stethoscope size={20} className="text-primary-500" />
          Tarifa de Revisión Técnica
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Monto fijo a cobrar cuando un cliente no acepta el presupuesto de reparación o desiste luego del diagnóstico en taller.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Monto de revisión ($ ARS)
          </label>
          <div className="relative max-w-sm">
            <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={revisionFee}
              onChange={(e) => setRevisionFee(e.target.value)}
              placeholder="5000"
              className={`${inputCls} pl-8 font-mono text-base font-semibold`}
            />
          </div>

          {/* Botones de ajuste rápido */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-slate-400">Ajuste rápido:</span>
            <button
              type="button"
              onClick={() => addPreset(1000)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              + $1.000
            </button>
            <button
              type="button"
              onClick={() => addPreset(5000)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              + $5.000
            </button>
            <button
              type="button"
              onClick={() => addPreset(10000)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              + $10.000
            </button>
            <button
              type="button"
              onClick={() => setRevisionFee('0')}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            >
              $0 (Sin costo)
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40 max-w-sm">
            <span className="text-slate-500 dark:text-slate-400">Total formateado: </span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              {formatMoney(Number(revisionFee) || 0)}
            </span>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar costo de revisión'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ----------------------------------------------------
// 2. Pestaña Opciones de Orden (Accesorios, Estados, Arreglos)
// ----------------------------------------------------
function OptionsSection({ catalogLists, saveCatalogLists }) {
  const [subTab, setSubTab] = useState('accessories')
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const setMsg = useNotify('success')

  const SUB_TABS = [
    { key: 'accessories', label: 'Accesorios', icon: Package, items: catalogLists.accessories || [], desc: 'Accesorios que acompañan al equipo (funda, cargador, tarjeta SIM, etc.).' },
    { key: 'conditions', label: 'Estados de ingreso', icon: MonitorSmartphone, items: catalogLists.conditions || [], desc: 'Condiciones físicas o funcionales de recepción (pantalla rota, mojado, etc.).' },
    { key: 'fixes', label: 'Arreglos frecuentes', icon: Wrench, items: catalogLists.fixes || [], desc: 'Reparaciones comunes para autocompletar el diagnóstico o presupuesto.' },
  ]

  const activeSub = SUB_TABS.find((s) => s.key === subTab)
  const list = activeSub.items

  const normalizedDraft = draft.trim()
  const isDuplicate = normalizedDraft && list.some((x) => x.toLowerCase() === normalizedDraft.toLowerCase())

  const addItem = async () => {
    if (!normalizedDraft || isDuplicate || saving) return
    const updated = [...list, normalizedDraft]
    setSaving(true)
    setMsg(null)
    const res = await saveCatalogLists({ [subTab]: updated })
    if (res.error) {
      setMsg({ type: 'error', text: res.error })
    } else {
      setDraft('')
      setMsg({ type: 'ok', text: `Opción "${normalizedDraft}" agregada a ${activeSub.label}.` })
    }
    setSaving(false)
  }

  const removeItem = async (idx) => {
    if (saving) return
    const updated = list.filter((_, i) => i !== idx)
    setSaving(true)
    setMsg(null)
    const res = await saveCatalogLists({ [subTab]: updated })
    if (res.error) {
      setMsg({ type: 'error', text: res.error })
    } else {
      setMsg({ type: 'ok', text: 'Opción eliminada.' })
    }
    setSaving(false)
  }

  const filteredItems = useMemo(() => {
    if (!filter.trim()) return list.map((item, idx) => ({ item, idx }))
    const q = filter.toLowerCase().trim()
    return list
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.toLowerCase().includes(q))
  }, [list, filter])

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  return (
    <div className="space-y-6">
      {/* Sub-pestañas tipo píldoras suaves */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
        {SUB_TABS.map((sub) => {
          const Icon = sub.icon
          const isActive = subTab === sub.key
          return (
            <button
              key={sub.key}
              type="button"
              onClick={() => {
                setSubTab(sub.key)
                setDraft('')
                setFilter('')
                setMsg(null)
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <Icon size={15} />
              <span>{sub.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive
                    ? 'bg-white/20 text-white dark:bg-black/10 dark:text-slate-900'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                }`}
              >
                {sub.items.length}
              </span>
            </button>
          )
        })}
      </div>

      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{activeSub.desc}</p>
      </div>

      {/* Buscador interno si hay más de 6 opciones */}
      {list.length > 6 && (
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filtrar entre las ${list.length} opciones cargadas...`}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-8 text-xs outline-none transition focus:border-primary-500 focus:bg-white focus:ring-1 focus:ring-primary-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Lista de chips en línea */}
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-800">
          Sin opciones cargadas todavía en {activeSub.label.toLowerCase()}.
        </p>
      ) : filteredItems.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          No hay opciones que coincidan con &ldquo;{filter}&rdquo;
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filteredItems.map(({ item, idx }) => (
            <span
              key={`${item}-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {item}
              <button
                type="button"
                onClick={() => removeItem(idx)}
                disabled={saving}
                title={`Eliminar "${item}"`}
                className="rounded-full p-0.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-500/20"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Agregar nueva opción */}
      <div className="max-w-md space-y-1.5 pt-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Agregar nueva opción
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addItem()
              }
            }}
            placeholder={`Nueva opción para ${activeSub.label.toLowerCase()}...`}
            className={inputCls}
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!normalizedDraft || isDuplicate || saving}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white transition hover:bg-primary-700 disabled:opacity-40"
            title="Agregar opción"
          >
            <Plus size={18} />
          </button>
        </div>
        {isDuplicate && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Esta opción ya existe en la lista.
          </p>
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------
// 3. Pestaña Importar Catálogo (Modelos masivos)
// ----------------------------------------------------
function CatalogSection() {
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const setImportResult = useNotify('success')

  const parsedModels = useMemo(() => parseBulkModels(importText), [importText])
  const linesCount = useMemo(() => {
    return importText.split('\n').filter((l) => l.trim()).length
  }, [importText])

  const handleImport = async () => {
    if (importing || parsedModels.length === 0) return
    setImporting(true)
    setImportResult(null)
    try {
      const res = await api('/catalog/models/bulk', { method: 'POST', body: { models: parsedModels } })
      setImportResult({
        type: 'ok',
        text: `Importación exitosa: ${res.created} nuevos modelos creados. ${res.skipped} duplicados omitidos. Total en catálogo: ${res.total}.`,
      })
      setImportText('')
    } catch (e) {
      setImportResult({ type: 'error', text: e.message || 'Error al importar los modelos.' })
    } finally {
      setImporting(false)
    }
  }

  const handleLoadSample = () => {
    setImportText(SAMPLE_MODELS)
    setImportResult(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Upload size={20} className="text-primary-500" />
          Carga Masiva de Marcas y Modelos
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Cargá rápidamente lotes de marcas y modelos para autocompletar en la recepción de equipos.
        </p>
      </div>

      {/* Barra de formato y acciones */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Formato: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-primary-600 dark:bg-slate-700 dark:text-primary-300">Marca, Modelo</code> o <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-primary-600 dark:bg-slate-700 dark:text-primary-300">Marca Modelo</code> (una línea por modelo).
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Sparkles size={13} className="text-amber-500" />
            Pegar plantilla de ejemplo
          </button>
          {importText && (
            <button
              type="button"
              onClick={() => {
                setImportText('')
                setImportResult(null)
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-500/10"
            >
              <Trash2 size={13} />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={importText}
        onChange={(e) => {
          setImportText(e.target.value)
          setImportResult(null)
        }}
        placeholder={"Samsung, Galaxy S25 Ultra\nApple, iPhone 16 Pro\nMotorola, Edge 50\nXiaomi, Redmi Note 13"}
        rows={9}
        className="w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      />

      {/* Desglose en vivo */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-500 dark:text-slate-400">
            <strong className="text-slate-700 dark:text-slate-200">{linesCount}</strong> {linesCount === 1 ? 'línea escrita' : 'líneas escritas'}
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="text-slate-500 dark:text-slate-400">
            <strong className="text-primary-600 dark:text-primary-400">{parsedModels.length}</strong> modelos válidos a importar
          </span>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={handleImport}
          disabled={importing || parsedModels.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
        >
          <Upload size={16} />
          {importing ? 'Importando al catálogo...' : `Importar ${parsedModels.length} modelos`}
        </button>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// 4. Pestaña Términos Legales (Editor de texto único y fluido)
// ----------------------------------------------------
function TermsSection({ catalogLists, saveCatalogLists }) {
  const [text, setText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const setMsg = useNotify('success')
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (!dirty) {
      setText(clausesToTermsText(catalogLists.terms || []))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogLists.terms])

  const parsedClauses = useMemo(() => termsTextToClauses(text), [text])
  const totalChars = useMemo(() => calculateTermsTotal(parsedClauses), [parsedClauses])
  const over = totalChars > MAX_TERMS_CHARS
  const charPct = Math.min(100, Math.round((totalChars / MAX_TERMS_CHARS) * 100))

  const handleSave = async () => {
    if (saving || over) return
    setSaving(true)
    setMsg(null)
    const res = await saveCatalogLists({ terms: parsedClauses })
    if (res.error) {
      setMsg({ type: 'error', text: res.error })
    } else {
      setDirty(false)
      setMsg({ type: 'ok', text: `Términos y condiciones guardados con éxito (${parsedClauses.length} cláusulas).` })
    }
    setSaving(false)
  }

  const handleLoadSample = () => {
    setText(clausesToTermsText(DEFAULT_TERMS_SAMPLE))
    setDirty(true)
    setMsg(null)
  }

  const progressColor =
    totalChars > MAX_TERMS_CHARS
      ? 'bg-red-500'
      : totalChars > 1250
      ? 'bg-amber-500'
      : 'bg-emerald-500'

  return (
    <div className="space-y-6">
      {/* Cabecera con título y acciones rápidas */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <FileText size={20} className="text-primary-500" />
            Términos y Condiciones Legales
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Escribí o pegá el texto completo. Cada párrafo o salto de línea representará una cláusula numerada en el comprobante impreso.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Sparkles size={14} className="text-amber-500" />
            Plantilla por defecto
          </button>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPreview ? 'Ocultar vista previa' : 'Vista previa de ticket'}
          </button>
        </div>
      </div>

      {/* Barra de estado de caracteres y cláusulas */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              Espacio ocupado en comprobante:
            </span>
            <span
              className={`font-mono font-bold ${
                over ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {totalChars} / {MAX_TERMS_CHARS} caracteres ({charPct}%)
            </span>
          </div>
          <span className="rounded-full bg-slate-200 px-2.5 py-0.5 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {parsedClauses.length} {parsedClauses.length === 1 ? 'cláusula detectada' : 'cláusulas detectadas'}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${charPct}%` }}
          />
        </div>
        {over && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
            <AlertCircle size={14} />
            El límite total es {MAX_TERMS_CHARS} caracteres. Reducí el texto antes de guardar.
          </p>
        )}
      </div>

      {/* Vista previa de ticket térmico */}
      {showPreview && (
        <div className="rounded-xl border border-slate-300 bg-amber-50/30 p-4 font-mono text-xs dark:border-slate-700 dark:bg-slate-900/60">
          <p className="mb-2 font-sans font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            --- Vista previa del pie de comprobante impreso (Ticket 80mm) ---
          </p>
          <div className="space-y-1.5 text-slate-600 dark:text-slate-400">
            {parsedClauses.map((term, i) => (
              <p key={i}>
                {i + 1}. {term}
              </p>
            ))}
            {parsedClauses.length === 0 && <p className="italic text-slate-400">Sin cláusulas configuradas.</p>}
          </div>
        </div>
      )}

      {/* Editor de texto único (Textarea amplio y cómodo) */}
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setDirty(true)
            setMsg(null)
          }}
          placeholder="Escribí aquí los términos y condiciones del taller..."
          rows={12}
          className="w-full rounded-xl border border-slate-300 bg-white p-4 font-sans text-sm leading-relaxed text-slate-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <p className="text-xs text-slate-400">
          Tip: Podés separar las cláusulas con saltos de línea. La numeración (1., 2., etc.) se asignará automáticamente en el comprobante impreso.
        </p>
      </div>

      {/* Guardar cambios */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="text-xs text-slate-400">
          {dirty ? 'Tenés cambios sin guardar.' : 'Las cláusulas están sincronizadas.'}
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty || over}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar términos y condiciones'}
        </button>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// 5. Pestaña Técnicos Externos
// ----------------------------------------------------
function TechniciansSection({ catalogLists, saveCatalogLists }) {
  const [list, setList] = useState(catalogLists.externalTechnicians || [])
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const setMsg = useNotify('success')

  useEffect(() => {
    setList(catalogLists.externalTechnicians || [])
  }, [catalogLists.externalTechnicians])

  const normalizedDraft = draft.trim()
  const isDuplicate = normalizedDraft && list.some((x) => x.toLowerCase() === normalizedDraft.toLowerCase())

  const addItem = async () => {
    if (!normalizedDraft || isDuplicate || saving) return
    const updated = [...list, normalizedDraft]
    setSaving(true)
    setMsg(null)
    const res = await saveCatalogLists({ externalTechnicians: updated })
    if (res.error) {
      setMsg({ type: 'error', text: res.error })
    } else {
      setDraft('')
      setMsg({ type: 'ok', text: `Técnico "${normalizedDraft}" agregado.` })
    }
    setSaving(false)
  }

  const removeItem = async (idx) => {
    if (saving) return
    const updated = list.filter((_, i) => i !== idx)
    setSaving(true)
    setMsg(null)
    const res = await saveCatalogLists({ externalTechnicians: updated })
    if (res.error) {
      setMsg({ type: 'error', text: res.error })
    } else {
      setMsg({ type: 'ok', text: 'Técnico eliminado.' })
    }
    setSaving(false)
  }

  const filteredItems = useMemo(() => {
    if (!filter.trim()) return list.map((item, idx) => ({ item, idx }))
    const q = filter.toLowerCase().trim()
    return list
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.toLowerCase().includes(q))
  }, [list, filter])

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Users size={20} className="text-amber-500" />
          Técnicos y Laboratorios Externos
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Talleres especializados disponibles para derivación de reparaciones fuera de nuestro laboratorio principal.
        </p>
      </div>

      {/* Buscador si hay más de 6 */}
      {list.length > 6 && (
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filtrar entre los ${list.length} técnicos...`}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-8 text-xs outline-none transition focus:border-primary-500 focus:bg-white focus:ring-1 focus:ring-primary-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-white"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Chips */}
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-800">
          Sin técnicos externos registrados.
        </p>
      ) : filteredItems.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          No hay técnicos que coincidan con &ldquo;{filter}&rdquo;
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filteredItems.map(({ item, idx }) => (
            <span
              key={`${item}-${idx}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {item}
              <button
                type="button"
                onClick={() => removeItem(idx)}
                disabled={saving}
                title={`Eliminar "${item}"`}
                className="rounded-full p-0.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-500/20"
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Agregar técnico */}
      <div className="max-w-md space-y-1.5 pt-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Registrar nuevo técnico
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addItem()
              }
            }}
            placeholder="Nombre del técnico o taller tercerizado..."
            className={inputCls}
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!normalizedDraft || isDuplicate || saving}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white transition hover:bg-primary-700 disabled:opacity-40"
            title="Agregar técnico"
          >
            <Plus size={18} />
          </button>
        </div>
        {isDuplicate && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Este técnico ya se encuentra registrado.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200 max-w-2xl">
        <p className="flex items-center gap-1.5 font-semibold">
          <HelpCircle size={15} className="text-amber-600 dark:text-amber-400" />
          ¿Cómo se utilizan los técnicos externos?
        </p>
        <p className="mt-1 text-amber-800 dark:text-amber-300/90">
          Al usar la acción &ldquo;Enviar a técnico externo&rdquo; en una orden, podrás seleccionar a cualquiera de estos técnicos y cargar el costo derivado. Las órdenes enviadas aparecerán en la pestaña &ldquo;Externos&rdquo; del Taller y en el Dashboard.
        </p>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// Definición de las Pestañas (Estructura idéntica al Dashboard)
// ----------------------------------------------------
const SETTINGS_TABS = [
  { key: 'general', label: 'General', Icon: Sliders },
  { key: 'impresoras', label: 'Impresoras', Icon: Printer },
  { key: 'opciones', label: 'Opciones de orden', Icon: Tags },
  { key: 'catalogo', label: 'Importar catálogo', Icon: Upload },
  { key: 'terminos', label: 'Términos legales', Icon: FileText },
  { key: 'externos', label: 'Técnicos externos', Icon: Users },
]

// ----------------------------------------------------
// Componente Principal
// ----------------------------------------------------
export default function Settings() {
  const { config, saveConfig, catalogLists, saveCatalogLists } = useData()
  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = searchParams.get('tab')
  const activeTab = SETTINGS_TABS.some((t) => t.key === tabParam) ? tabParam : 'general'

  const setActiveTab = (tab) => {
    setSearchParams({ tab }, { replace: true })
  }

  // Contadores para las insignias estilo Dashboard
  const counts = {
    opciones:
      (catalogLists.accessories?.length || 0) +
      (catalogLists.conditions?.length || 0) +
      (catalogLists.fixes?.length || 0),
    terminos: catalogLists.terms?.length || 0,
    externos: catalogLists.externalTechnicians?.length || 0,
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Parámetros operativos del taller, listas rápidas y cláusulas de comprobantes
        </p>
      </div>

      {/* Contenedor principal idéntico al Dashboard */}
      <Card className="!p-0 overflow-hidden">
        {/* Barra de pestañas con borde inferior */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.key
            const badgeCount = counts[tab.key]

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition whitespace-nowrap
                  ${
                    isActive
                      ? 'border-b-2 border-primary-600 text-primary-600 dark:border-primary-500 dark:text-primary-400'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
              >
                <tab.Icon size={16} />
                <span>{tab.label}</span>
                {badgeCount !== undefined && (
                  <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                    {badgeCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Contenido sin cards anidadas */}
        <div className="p-6 sm:p-8 animate-fadeIn">
          {activeTab === 'general' && (
            <GeneralSection
              config={config}
              saveConfig={saveConfig}
            />
          )}

          {activeTab === 'opciones' && (
            <OptionsSection
              catalogLists={catalogLists}
              saveCatalogLists={saveCatalogLists}
            />
          )}

          {activeTab === 'catalogo' && <CatalogSection />}
          {activeTab === 'impresoras' && <PrinterSettings />}

          {activeTab === 'terminos' && (
            <TermsSection
              catalogLists={catalogLists}
              saveCatalogLists={saveCatalogLists}
            />
          )}

          {activeTab === 'externos' && (
            <TechniciansSection
              catalogLists={catalogLists}
              saveCatalogLists={saveCatalogLists}
            />
          )}
        </div>
      </Card>
    </div>
  )
}
