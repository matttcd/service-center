import { useAuth } from '../context/AuthContext.jsx'
import AccountSettings from './AccountSettings.jsx'
import PageHeading from '../components/PageHeading.jsx'
import { useNotify } from '../context/notifications.js'
import { useEffect, useState, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Bold,
  Italic,
  Underline,
  Save,
  UserRound,
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
  Sparkles,
  Trash2,
  HelpCircle,
  Printer,
} from 'lucide-react'
import PrinterSettings from '../components/PrinterSettings.jsx'
import { useData } from '../context/DataContext.jsx'
import Card from '../components/Card.jsx'
import { formatMoney, parseBulkModels, termsTextToClauses } from '../utils/helpers.js'
import { cleanTerm, MAX_TERMS_CHARS, termsLength } from '../../shared/terms.js'
import { api } from '../utils/api.js'

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
      <div className="sc-settings-filters" role="group" aria-label="Opciones de orden">
        {SUB_TABS.map((sub) => {
          const Icon = sub.icon
          const isActive = subTab === sub.key
          return (
            <button
              key={sub.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setSubTab(sub.key)
                setDraft('')
                setFilter('')
                setMsg(null)
              }}
              className="ws-button"
            >
              <Icon size={15} />
              <span>{sub.label}</span>
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

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-800">
          Sin opciones cargadas todavía en {activeSub.label.toLowerCase()}.
        </p>
      ) : filteredItems.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          No hay opciones que coincidan con &ldquo;{filter}&rdquo;
        </p>
      ) : (
        <ul className="sc-settings-list">
          {filteredItems.map(({ item, idx }) => (
            <li key={`${item}-${idx}`}>
              {item}
              <button
                type="button"
                onClick={() => removeItem(idx)}
                disabled={saving}
                title={`Eliminar "${item}"`}
                className="ws-icon-button"
                aria-label={`Eliminar ${item}`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
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
const TERM_FORMATS = [
  ['bold', 'Negrita', Bold],
  ['italic', 'Cursiva', Italic],
  ['underline', 'Subrayado', Underline],
]

function TermsSection({ catalogLists, saveCatalogLists }) {
  const editor = useRef(null)
  const selection = useRef(null)
  const synchronized = useRef(null)
  const [clauses, setClauses] = useState([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const notify = useNotify('success')

  const load = (terms) => {
    const safe = terms.map(cleanTerm)
    const html = safe.map((term) => `<div>${term}</div>`).join('')
    if (editor.current.innerHTML !== html) {
      editor.current.innerHTML = html
      selection.current = null
    }
    setClauses(safe)
  }
  useEffect(() => {
    if (synchronized.current === catalogLists.terms) return
    synchronized.current = catalogLists.terms
    if (!dirty) load(catalogLists.terms || [])
  }, [catalogLists.terms, dirty])

  useEffect(() => {
    const remember = () => {
      const active = window.getSelection()
      if (active.rangeCount && editor.current?.contains(active.anchorNode) && editor.current.contains(active.focusNode)) {
        selection.current = active.getRangeAt(0).cloneRange()
      }
    }
    document.addEventListener('selectionchange', remember)
    return () => document.removeEventListener('selectionchange', remember)
  }, [])

  const change = () => {
    const text = editor.current.innerHTML.replace(/<\/?(?:div|p)>|<br\s*\/?>/gi, '\n').replaceAll('&nbsp;', ' ')
    setClauses(termsTextToClauses(text).map(cleanTerm).filter((term) => termsLength([term]) > 0))
    setDirty(true)
  }

  const format = (command) => {
    const range = selection.current
    if (!range || !editor.current.contains(range.commonAncestorContainer)) {
      editor.current.focus()
      return
    }
    editor.current.focus()
    const active = window.getSelection()
    active.removeAllRanges()
    active.addRange(range)
    // shortcut: native editing preserves undo; switch to an editor library if browser support changes.
    document.execCommand('styleWithCSS', false, false)
    if (document.execCommand(command)) change()
  }

  const totalChars = termsLength(clauses)
  const over = totalChars > MAX_TERMS_CHARS
  const handleSave = async () => {
    if (saving || over || !dirty) return
    setSaving(true)
    const res = await saveCatalogLists({ terms: clauses })
    if (res.error) notify({ type: 'error', text: res.error })
    else {
      setDirty(false)
      notify({ type: 'ok', text: 'Términos y condiciones guardados.' })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 id="terms-title" className="font-semibold">Términos y condiciones</h2>
        <p id="terms-hint" className="sc-secondary">Cada párrafo se numera en el comprobante.</p>
      </header>
      <div className="sc-terms">
        <div className="sc-terms-tools" role="group" aria-label="Formato del texto">
          {TERM_FORMATS.map(([command, label, Icon]) => <button key={command} type="button" title={label} aria-label={label} className="ws-icon-button" disabled={saving} onMouseDown={(event) => event.preventDefault()} onClick={() => format(command)}><Icon size={16} aria-hidden="true" /></button>)}
        </div>
        <div ref={editor} className="sc-terms-editor" role="textbox" aria-labelledby="terms-title" aria-describedby="terms-hint terms-count" aria-multiline="true" aria-readonly={saving} contentEditable={!saving}
          onInput={change} onDrop={(event) => event.preventDefault()} onPaste={(event) => {
            event.preventDefault()
            if (document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))) change()
          }}
        />
      </div>
      <div className="sc-terms-footer">
        <span id="terms-count" className={over ? 'text-red-600 dark:text-red-400' : 'sc-secondary'}>{totalChars} / {MAX_TERMS_CHARS} caracteres</span>
        <div className="ws-buttons">
          <button type="button" className="ws-button" disabled={saving} onClick={() => { load(DEFAULT_TERMS_SAMPLE); setDirty(true) }}>Plantilla por defecto</button>
          <button type="button" className="ws-button" aria-expanded={showPreview} aria-controls="terms-preview" onClick={() => setShowPreview(!showPreview)}>Vista previa</button>
          <button type="button" className="ws-button primary" disabled={saving || !dirty || over} onClick={handleSave}><Save size={16} />{saving ? 'Guardando…' : 'Guardar términos'}</button>
        </div>
      </div>
      {showPreview && <section id="terms-preview" className="sc-terms-preview" aria-label="Vista previa del comprobante">
        <h3 className="font-semibold">En el comprobante</h3>
        {clauses.length ? <ol>{clauses.map((clause, index) => <li key={index} dangerouslySetInnerHTML={{ __html: clause }} />)}</ol> : <p className="sc-secondary">Sin cláusulas configuradas.</p>}
      </section>}
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

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-800">
          Sin técnicos externos registrados.
        </p>
      ) : filteredItems.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          No hay técnicos que coincidan con &ldquo;{filter}&rdquo;
        </p>
      ) : (
        <ul className="sc-settings-list">
          {filteredItems.map(({ item, idx }) => (
            <li key={`${item}-${idx}`}>
              {item}
              <button
                type="button"
                onClick={() => removeItem(idx)}
                disabled={saving}
                title={`Eliminar "${item}"`}
                className="ws-icon-button"
                aria-label={`Eliminar ${item}`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
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
          Al usar la acción &ldquo;Enviar a técnico externo&rdquo; en una orden, podrás seleccionar a cualquiera de estos técnicos y cargar el costo derivado. Las órdenes enviadas aparecerán en Recepción, en la pestaña &ldquo;Externos&rdquo;.
        </p>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// Definición de las Pestañas (Estructura idéntica al Dashboard)
// ----------------------------------------------------
const SETTINGS_TABS = [
  { key: 'cuenta', label: 'Mi cuenta', Icon: UserRound },
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
  const { currentUser } = useAuth()
  const admin = currentUser.role === 'admin'
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab = admin && SETTINGS_TABS.some(({ key }) => key === tabParam) ? tabParam : 'cuenta'
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true })

  return (
    <div>
      <PageHeading title="Ajustes" description="Cuenta y preferencias" />
      <div className={`sc-settings ${admin ? 'sc-settings-admin' : ''}`}>
        {admin && <nav className="sc-settings-nav" aria-label="Secciones de ajustes">
          {SETTINGS_TABS.map(({ key, label, Icon }) => <Link key={key} id={`settings-${key}`} to={`?tab=${key}`} replace aria-current={activeTab === key ? 'page' : undefined}><Icon size={17} aria-hidden="true" />{label}</Link>)}
        </nav>}
        {admin && <label className="sc-settings-select">
          <span>Sección</span>
          <select className="ws-button" value={activeTab} onChange={(event) => setActiveTab(event.target.value)}>
            {SETTINGS_TABS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>}
        <Card className="sc-settings-panel">
          {activeTab === 'cuenta' && <AccountSettings />}
          {activeTab === 'general' && <GeneralSection config={config} saveConfig={saveConfig} />}
          {activeTab === 'opciones' && <OptionsSection catalogLists={catalogLists} saveCatalogLists={saveCatalogLists} />}
          {activeTab === 'catalogo' && <CatalogSection />}
          {activeTab === 'impresoras' && <PrinterSettings />}
          {activeTab === 'terminos' && <TermsSection catalogLists={catalogLists} saveCatalogLists={saveCatalogLists} />}
          {activeTab === 'externos' && <TechniciansSection catalogLists={catalogLists} saveCatalogLists={saveCatalogLists} />}
        </Card>
      </div>
    </div>
  )
}
