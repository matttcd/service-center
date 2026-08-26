// ============================================
// Clientes: listado en tabla con ordenamiento,
// búsqueda, filtros y paginación (estilo Órdenes).
// ============================================
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ArrowUp, ArrowDown, ChevronsUpDown, ChevronUp, ChevronDown, X } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import CustomerForm from '../components/CustomerForm.jsx'
import { formatDate, titleCase } from '../utils/helpers.js'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function Clients() {
  const { customers, orders, addCustomer } = useData()
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  // Ordenamiento
  const [sortKey, setSortKey] = useState('fullName')
  const [sortDir, setSortDir] = useState('asc')

  // Paginación
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1])

  // Búsqueda con debounce
  useMemo(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers
      .map((c) => ({
        ...c,
        ordersCount: orders.filter((o) => o.customerId === c.id).length,
      }))
      .filter((c) => {
        if (!q) return true
        return (
          c.fullName.toLowerCase().includes(q) ||
          (c.dni || '').includes(q) ||
          (c.phone || '').includes(q) ||
          (c.phone2 || '').toLowerCase().includes(q) ||
          (c.phone3 || '').toLowerCase().includes(q) ||
          (c.address || '').toLowerCase().includes(q)
        )
      })
  }, [customers, orders, search])

  const sorted = useMemo(() => {
    const cmp = (a, b) => {
      switch (sortKey) {
        case 'ordersCount':
          return (a.ordersCount || 0) - (b.ordersCount || 0)
        default: {
          const va = a[sortKey] || ''
          const vb = b[sortKey] || ''
          return String(va).localeCompare(String(vb), 'es-AR')
        }
      }
    }
    const list = [...rows].sort(cmp)
    return sortDir === 'desc' ? list.reverse() : list
  }, [rows, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.max(1, Math.min(page, totalPages))
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  const toggleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

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

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  const thCls =
    'group cursor-pointer select-none whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronsUpDown size={12} className="ml-1 inline opacity-40" />
    return sortDir === 'asc' ? <ArrowUp size={12} className="ml-1 inline" /> : <ArrowDown size={12} className="ml-1 inline" />
  }

  const Th = ({ col, className = '', children }) => (
    <th onClick={() => toggleSort(col)} className={`${thCls} ${className}`}>
      <span className="inline-flex items-center">
        {children}
        <SortIcon col={col} />
      </span>
    </th>
  )

  const navBtn =
    'inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clientes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{rows.length} de {customers.length} clientes</p>
        </div>
        <button
          onClick={() => { setFormError(''); setFormOpen(true) }}
          className="inline-flex items-center gap-2 self-start rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          <Plus size={16} />
          Nuevo cliente
        </button>
      </div>

      {notice && (
        <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
          {notice}
        </p>
      )}

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1) }}
              placeholder="Buscar por nombre, DNI, teléfono o dirección..."
              className={`${inputCls} pl-9`}
            />
          </div>
          {search && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
            >
              <X size={13} />
              Limpiar
            </button>
          )}
        </div>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden">
        {paged.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            No hay clientes que coincidan con la búsqueda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                  <Th col="fullName">Nombre</Th>
                  <Th col="dni">DNI</Th>
                  <Th col="phone">Teléfono</Th>
                  <Th col="address">Dirección</Th>
                  <Th col="ordersCount" className="text-center">Órdenes</Th>
                  <Th col="createdAt">Registro</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paged.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/clientes/${c.id}`)}
                    className={`cursor-pointer transition hover:bg-primary-50 dark:hover:bg-primary-500/10 ${
                      i % 2 === 1 ? 'bg-slate-50/60 dark:bg-slate-800/30' : ''
                    }`}
                  >
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600 dark:bg-primary-500/15 dark:text-primary-400">
                          {c.fullName.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'}
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-white">{titleCase(c.fullName)}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-200">{c.dni || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-200">
                      {[c.phone, c.phone2, c.phone3].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2.5 text-slate-500 dark:text-slate-400" title={c.address}>
                      {c.address || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      <Badge tone={c.ordersCount > 0 ? 'primary' : 'slate'}>{c.ordersCount}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-500 dark:text-slate-400">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {sorted.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Mostrando</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>por página · {sorted.length} en total</span>
            </div>
            <div className="flex items-center gap-2">
              <button className={navBtn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                <ChevronUp size={14} className="rotate-90" />
                Anterior
              </button>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {safePage} / {totalPages}
              </span>
              <button className={navBtn} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                Siguiente
                <ChevronDown size={14} className="-rotate-90" />
              </button>
            </div>
          </div>
        )}
      </Card>

      <CustomerForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setFormError('') }}
        onSubmit={handleSave}
        serverError={formError}
      />
    </div>
  )
}
