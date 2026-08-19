// ============================================
// Settings: configuración general (solo admin)
// ============================================
import { useEffect, useState } from 'react'
import { Save, AlertCircle, CheckCircle2, Stethoscope } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import Card from '../components/Card.jsx'
import { formatMoney } from '../utils/helpers.js'

export default function Settings() {
  const { config, saveConfig } = useData()
  const [revisionFee, setRevisionFee] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!config) return
    setRevisionFee(String(config.revisionFee ?? ''))
  }, [config])

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  const handleSubmit = async (e) => {
    e.preventDefault()
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
    </div>
  )
}