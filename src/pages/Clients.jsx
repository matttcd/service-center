// ============================================
// Clientes: listado y búsqueda. La fila abre el detalle del cliente
// el alta se hace acá y la edición / baja en el detalle.
// ============================================
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus, ChevronRight } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import CustomerForm from '../components/CustomerForm.jsx'
import Card from '../components/Card.jsx'

export default function Clients() {
  const { customers, orders, addCustomer } = useData()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
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
          (customer.dni || '').includes(q) ||
          (customer.phone || '').includes(q) ||
          (customer.phone2 || '').toLowerCase().includes(q) ||
          (customer.phone3 || '').toLowerCase().includes(q)
        )
      })
  }, [customers, orders, search])

  const handleSave = async (form) => {
    const res = await addCustomer(form)
    if (res?.error) {
      setFormError(res.error)
      return
    }
    setFormError('')
    setFormOpen(false)
    setNotice('Cliente guardado.')
    window.setTimeout(() => setNotice(''), 4000)
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
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600 dark:bg-primary-500/15 dark:text-primary-400">
                    {c.fullName
                      .split(' ')
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase())
                      .join('') || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">{c.fullName}</p>
                    <p className="truncate text-sm text-slate-400">
                      DNI {c.dni || '—'} ·{' '}
                      {[c.phone, c.phone2, c.phone3].filter(Boolean).join(' · ') || 'Sin teléfono'}
                    </p>
                    <p className="text-xs text-slate-400">{ordersCount} orden(es)</p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-slate-300 dark:text-slate-600" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CustomerForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setFormError('')
        }}
        onSubmit={handleSave}
        serverError={formError}
      />
    </div>
  )
}