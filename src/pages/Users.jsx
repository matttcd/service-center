// ============================================
// Usuarios: gestión de usuarios (solo admin)
// ============================================
import { useEffect, useState, useCallback } from 'react'
import { UserPlus, ShieldCheck, Shield, Wrench, History } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../utils/api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import UserForm from '../components/UserForm.jsx'
import Modal from '../components/Modal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'

// Etiquetas legibles para la auditoría.
const actionLabel = {
  create: 'Creación',
  update: 'Edición',
  delete: 'Baja',
  status: 'Estado',
  toggle: 'Estado usuario',
  password_change: 'Contraseña',
  seed: 'Inicialización',
  restore: 'Restauración',
  whatsapp: 'WhatsApp',
  whatsapp_error: 'WhatsApp falló',
}

const actionTone = (action) => {
  if (action === 'whatsapp' || action === 'restore') return 'green'
  if (action === 'whatsapp_error') return 'red'
  if (action === 'delete') return 'red'
  if (action === 'status') return 'primary'
  if (action === 'create') return 'primary'
  return 'slate'
}

export default function Users() {
  const { users, addUser, toggleUserActive } = useData()
  const { currentUser } = useAuth()
  const [formOpen, setFormOpen] = useState(false)
  const [logs, setLogs] = useState([])
  const [logTotal, setLogTotal] = useState(0)
  const [logPage, setLogPage] = useState(1)
  const [logPages, setLogPages] = useState(1)
  const [confirmToggle, setConfirmToggle] = useState(null)
  const [alertModal, setAlertModal] = useState(null)

  // Carga el historial de auditoría paginado (solo admin llega a esta página).
  const loadLogs = useCallback(async (page) => {
    try {
      const res = await api(`/audit?page=${page}&limit=50`)
      setLogs(res.logs || [])
      setLogTotal(res.total || 0)
      setLogPages(res.pages || 1)
    } catch {
      setLogs([])
    }
  }, [])

  useEffect(() => {
    if (users.length) setLogPage(1)
  }, [users.length])

  useEffect(() => {
    loadLogs(logPage)
  }, [logPage, loadLogs])

  const handleCreate = (form) => addUser(form)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Usuarios</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gestioná los accesos al sistema
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 self-start rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          <UserPlus size={16} />
          Nuevo usuario
        </button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
                <th className="px-5 py-3 font-semibold">Usuario</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id
                return (
                  <tr
                    key={u.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50 last:border-0 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600 dark:bg-primary-500/15 dark:text-primary-400">
                          {u.name
                            .split(' ')
                            .slice(0, 2)
                            .map((w) => w[0].toUpperCase())
                            .join('')}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {u.name}
                            {isSelf && (
                              <span className="ml-2 text-xs font-normal text-slate-400">(vos)</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'admin' ? (
                        <Badge tone="primary">
                          <ShieldCheck size={12} />
                          Administrador
                        </Badge>
                      ) : u.role === 'tecnico' ? (
                        <Badge tone="yellow">
                          <Wrench size={12} />
                          Técnico
                        </Badge>
                      ) : (
                        <Badge tone="slate">
                          <Shield size={12} />
                          Mostrador
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'Activo' : 'Desactivado'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isSelf ? (
                        <span className="text-xs text-slate-400">No se puede desactivar</span>
                      ) : (
                        <button
                          onClick={() => setConfirmToggle(u)}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                            u.active
                              ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500/30 dark:hover:bg-emerald-500/10'
                          }`}
                        >
                          {u.active ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <UserForm open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleCreate} />

      {/* Confirmación activar/desactivar usuario */}
      <Modal
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        title={confirmToggle?.active ? 'Desactivar usuario' : 'Activar usuario'}
      >
        {confirmToggle && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {confirmToggle.active ? (
                <>
                  ¿Desactivar a <span className="font-semibold">{confirmToggle.name}</span>? No va a
                  poder entrar al sistema hasta que lo actives de nuevo.
                </>
              ) : (
                <>
                  ¿Activar a <span className="font-semibold">{confirmToggle.name}</span>? Va a volver
                  a poder entrar al sistema.
                </>
              )}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmToggle(null)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { id } = confirmToggle
                  setConfirmToggle(null)
                  const res = await toggleUserActive(id)
                  if (res?.error) setAlertModal(res.error)
                }}
                className={`flex-1 rounded-lg px-4 py-2.5 font-semibold text-white transition ${
                  confirmToggle.active
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmToggle.active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Historial de auditoría */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <History size={18} className="text-slate-400" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Historial de auditoría</h2>
          <span className="ml-auto text-xs text-slate-400">{logTotal} registro(s)</span>
        </div>
        {logs.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate-400">Sin registros todavía.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">Usuario</th>
                    <th className="px-4 py-3 font-semibold">Acción</th>
                    <th className="px-4 py-3 font-semibold">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500 dark:text-slate-400">
                        {new Date(l.timestamp).toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">
                        {l.userName}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={actionTone(l.action)}>{actionLabel[l.action] || l.action}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        {l.details || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {logPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-800">
                <span className="text-xs text-slate-400">
                  Página {logPage} de {logPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setLogPage((p) => p - 1)}
                    disabled={logPage <= 1}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogPage((p) => p + 1)}
                    disabled={logPage >= logPages}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
      <ConfirmModal
        open={!!alertModal}
        onClose={() => setAlertModal(null)}
        onConfirm={() => setAlertModal(null)}
        title="Aviso"
        message={alertModal}
        type="alert"
      />
    </div>
  )
}