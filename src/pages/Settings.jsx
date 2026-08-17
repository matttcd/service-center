// ============================================
// Settings: configuración de WhatsApp para avisos (solo admin)
// ============================================
import { useEffect, useState } from 'react'
import { Save, Send, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import Card from '../components/Card.jsx'

const DEFAULT_TEMPLATE = 'Hola {cliente}, tu dispositivo ({dispositivo}) de {local} ya está listo para retirar. Orden {orden}.'

export default function Settings() {
  const { config, saveWhatsAppConfig } = useData()
  const [form, setForm] = useState({ instanceId: '', apiToken: '', local: '', messageTemplate: '' })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!config) return
    const w = config.whatsapp || {}
    setForm({
      instanceId: w.instanceId || '',
      apiToken: w.apiToken || '',
      local: w.local || '',
      messageTemplate: w.messageTemplate || DEFAULT_TEMPLATE,
    })
  }, [config])

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  const preview = form.messageTemplate
    .replace('{cliente}', 'Juan Pérez')
    .replace('{dispositivo}', 'Samsung Galaxy A15')
    .replace('{orden}', 'OS-0007')
    .replace('{local}', form.local || 'El Gringo Celulares')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setNotice(null)
    const res = await saveWhatsAppConfig(form)
    if (res.error) {
      setNotice({ type: 'error', text: res.error })
    } else {
      setNotice({ type: 'ok', text: 'Configuración de WhatsApp guardada.' })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Avisos por WhatsApp cuando un equipo queda listo para retirar
        </p>
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
            <Send size={18} className="text-emerald-500" />
            GreenAPI
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Al marcar un equipo como "terminado" se envía un mensaje automático al cliente. Necesitás
            una instancia en{' '}
            <a
              href="https://green-api.com"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary-600 hover:underline dark:text-primary-400"
            >
              green-api.com
            </a>{' '}
            y escanear el QR del WhatsApp que recibe los mensajes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                ID de instancia
              </label>
              <input
                type="text"
                value={form.instanceId}
                onChange={(e) => setForm((f) => ({ ...f, instanceId: e.target.value }))}
                placeholder="1101000000"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Token de instancia
              </label>
              <input
                type="password"
                value={form.apiToken}
                onChange={(e) => setForm((f) => ({ ...f, apiToken: e.target.value }))}
                placeholder="abc123..."
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nombre del local
            </label>
            <input
              type="text"
              value={form.local}
              onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))}
              placeholder="El Gringo Celulares"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Mensaje que recibe el cliente
            </label>
            <textarea
              value={form.messageTemplate}
              onChange={(e) => setForm((f) => ({ ...f, messageTemplate: e.target.value }))}
              rows={3}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-slate-400">
              Variables disponibles: {'{cliente}'} {'{dispositivo}'} {'{orden}'} {'{local}'}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Vista previa</p>
            <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {preview || 'Completá el mensaje para ver la vista previa.'}
            </div>
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