// ============================================
// ClientDetail: ficha del cliente, edición y baja (estilo cuotas2)
// + historial de sus órdenes de servicio.
// ============================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Mail, Phone, MapPin, AlertTriangle, ClipboardList } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import Modal from '../components/Modal.jsx'
import CustomerForm from '../components/CustomerForm.jsx'
import { formatDate, ORDER_STATUS_LABEL, orderStatusTone } from '../utils/helpers.js'

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { customers, orders, updateCustomer, deleteCustomer } = useData()
  const { currentUser } = useAuth()
  const isAdmin = currentUser?.role === 'admin'

  const customer = customers.find((c) => c.id === id)

  const [editOpen, setEditOpen] = useState(false)
  const [editError, setEditError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [notice, setNotice] = useState('')

  if (!customer) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-slate-400">Cliente no encontrado. Podría haber sido dado de baja.</p>
        <button
          onClick={() => navigate('/clientes')}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <ArrowLeft size={16} />
          Volver a clientes
        </button>
      </div>
    )
  }

  const customerOrders = orders
    .filter((o) => o.customerId === customer.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))

  const handleSaveCustomer = async (form) => {
    const res = await updateCustomer(customer.id, form)
    if (res?.error) {
      setEditError(res.error)
      return { error: res.error }
    }
    setEditError('')
    setEditOpen(false)
    setNotice('Cliente actualizado.')
    window.setTimeout(() => setNotice(''), 4000)
    return { error: null }
  }

  const handleDelete = async () => {
    const res = await deleteCustomer(customer.id)
    setConfirmDelete(false)
    if (res?.error) {
      setNotice(res.error)
      window.setTimeout(() => setNotice(''), 4000)
      return
    }
    navigate('/clientes')
  }

  const initials =
    customer.fullName
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/clientes')}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft size={16} />
        Volver a clientes
      </button>

      {notice && (
        <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
          {notice}
        </p>
      )}

      {/* Ficha del cliente */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-100 text-lg font-bold text-primary-600 dark:bg-primary-500/15 dark:text-primary-400">
              {initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{customer.fullName}</h1>
                <Badge tone="slate">DNI {customer.dni || '—'}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-slate-400">
                Cliente desde {formatDate(customer.createdAt)}
              </p>
              <div className="mt-3 flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                <p className="flex items-center gap-2">
                  <Phone size={15} className="text-slate-400" />
                  {[customer.phone, customer.phone2, customer.phone3].filter(Boolean).join(' · ') || 'Sin teléfono'}
                </p>
                <p className="flex items-center gap-2 truncate">
                  <Mail size={15} className="text-slate-400" />
                  {customer.email || 'Sin email'}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin size={15} className="text-slate-400" />
                  {customer.address || 'Sin dirección'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Pencil size={15} />
              Editar
            </button>
            {isAdmin && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
              >
                <Trash2 size={15} />
                Dar de baja
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Historial de órdenes */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <ClipboardList size={18} />
          Órdenes de servicio
          <span className="text-sm font-normal text-slate-400">({customerOrders.length})</span>
        </h2>

        {customerOrders.length === 0 ? (
          <Card>
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              Este cliente todavía no tiene órdenes de servicio.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {customerOrders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/ordenes/${o.id}`)}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {o.orderNumber}
                        <span className="ml-2 font-normal text-slate-600 dark:text-slate-300">
                          {o.brand} {o.model}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">{formatDate(o.createdAt)}</p>
                    </div>
                    <Badge tone={orderStatusTone(o.status)}>{ORDER_STATUS_LABEL[o.status] || o.status}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Edición */}
      <CustomerForm
        open={editOpen}
        onClose={() => {
          setEditOpen(false)
          setEditError('')
        }}
        onSubmit={handleSaveCustomer}
        initial={customer}
        serverError={editError}
      />

      {/* Confirmación de baja */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Dar de baja cliente">
        {customer && (
          <div className="space-y-4">
            <p className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
              <span className="flex-1">
                ¿Seguro que querés dar de baja a{' '}
                <span className="whitespace-nowrap font-semibold">{customer.fullName}</span>? Sus
                órdenes de servicio también se moverán a la papelera. Podés restaurarlas dentro de
                30 días.
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-700"
              >
                Sí, dar de baja
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}