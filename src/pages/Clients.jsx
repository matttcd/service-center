// ============================================
// Clientes: listado, búsqueda, alta y edición
// ============================================
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus, ClipboardList, Pencil, AlertTriangle, Trash2 } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import CustomerForm from '../components/CustomerForm.jsx'
import Card from '../components/Card.jsx'
import Modal from '../components/Modal.jsx'

export default function Clients() {
  const { customers, orders, addCustomer, updateCustomer, deleteCustomer } = useData()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const isAdmin = currentUser?.role === 'admin'

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers
      .map((c) => ({
        customer: c,
        ordersCount: orders.filter((o) => o.customerId === c.id).length,
      }))
      .filter(({ customer }) => {
        if (!q) return true
        return (
          customer.fullName.toLowerCase().includes(q) ||
          customer.dni.includes(q) ||
          (customer.phone || '').includes(q)
        )
      })
  }, [customers, orders, search])

  const handleSave = async (form) => {
    const res = editing ? await updateCustomer(editing.id, form) : await addCustomer(form)
    if (res?.error) {
      setFormError(res.error)
      return
    }
    setFormError('')
    setFormOpen(false)
    setEditing(null)
    setNotice('Cliente guardado.')
    window.setTimeout(() => setNotice(''), 4000)
  }

  const confirmDelete = async () => {
    const res = await deleteCustomer(toDelete.id)
    setToDelete(null)
    if (res.error) setNotice(res.error)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clientes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {rows.length} de {customers.length} clientes
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setFormError('')
            setFormOpen(true)
          }}
          className="inline-flex items-center gap-2 self-start rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          <UserPlus size={16} />
          Nuevo cliente
        </button>
      </div>

      {notice && (
        <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
          {notice}
        </p>
      )}

      {/* Búsqueda */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, DNI o teléfono..."
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            No hay clientes que coincidan con la búsqueda.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map(({ customer: c, ordersCount }) => (
              <li
                key={c.id}
                className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/40 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{c.fullName}</p>
                  <p className="text-sm text-slate-400">
                    DNI {c.dni || '—'} · {c.phone || '—'} {c.phone2 ? `· ${c.phone2}` : ''}
                  </p>
                  <p className="text-xs text-slate-400">{ordersCount} orden(es)</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/ordenes?q=${encodeURIComponent(c.fullName)}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ClipboardList size={14} />
                    Órdenes
                  </button>
                  <button
                    onClick={() => {
                      setEditing(c)
                      setFormError('')
                      setFormOpen(true)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Pencil size={14} />
                    Editar
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setToDelete(c)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CustomerForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
          setFormError('')
        }}
        onSubmit={handleSave}
        initial={editing}
        serverError={formError}
      />

      {/* Confirmación de baja */}
      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Eliminar cliente">
        {toDelete && (
          <div className="space-y-4">
            <p className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
              <span className="flex-1">
                ¿Seguro que querés eliminar a{' '}
                <span className="whitespace-nowrap font-semibold">{toDelete.fullName}</span>? Si tiene
                órdenes de servicio, no se podrá eliminar.
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setToDelete(null)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-700"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}