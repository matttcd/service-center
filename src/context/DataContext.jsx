// ============================================
// Contexto global de datos (obtenidos de la API)
// ============================================
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../utils/api.js'
import { useAuth } from './AuthContext.jsx'
import { loadSession } from '../utils/storage.js'
import { todayISO, toTime } from '../utils/helpers.js'

const DataContext = createContext(null)

const ACTIVIDAD_PAGE_SIZE = 50

export function DataProvider({ children }) {
  const { currentUser, logout } = useAuth()
  const [data, setData] = useState({
    customers: [],
    orders: [],
    users: [],
    technicians: [],
    config: null,
    catalog: { brands: [], models: [] },
  })
  const [actividad, setActividad] = useState([])
  const [actividadHasMore, setActividadHasMore] = useState(false)
  const [actividadError, setActividadError] = useState('')
  const [adminMetrics, setAdminMetrics] = useState(null)
  const [adminMetricsError, setAdminMetricsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [ordersRevision, setOrdersRevision] = useState(0)
  const [ordersPage, setOrdersPage] = useState({ orders: [], total: 0 })
  const [ordersLoading, setOrdersLoading] = useState(false)
  const today = todayISO()

  const refreshTimer = useRef(null)

  const doRefresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const res = await api('/bootstrap')
      setData({
        customers: res.customers || [],
        orders: res.orders || [],
        users: res.users || [],
        technicians: res.technicians || [],
        config: res.config || null,
        catalog: res.catalog || { brands: [], models: [] },
      })
      try {
        const act = await api(`/actividad?page=1&limit=${ACTIVIDAD_PAGE_SIZE}`)
        // Si ya se cargaron más páginas, no pisarlas: solo la primera se recarga.
        setActividad((prev) => (prev.length > ACTIVIDAD_PAGE_SIZE ? prev : act.logs || []))
        setActividadHasMore((act.page || 1) < (act.pages || 1))
        setActividadError('')
      } catch {
        setActividad([])
        setActividadHasMore(false)
        setActividadError('No se pudieron cargar los movimientos.')
      }
    } catch (err) {
      if (err.status === 401) logout()
    } finally {
      if (!silent) setLoading(false)
    }
    // Avisa a la vista de órdenes para que reconsulte su página paginada.
    setOrdersRevision((v) => v + 1)
  }, [logout])

  // Debounce: una mutación y el evento SSE disparan refresh casi al mismo
  // tiempo; colapsamos ambos en una sola descarga de bootstrap.
  const refresh = useCallback((opts) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null
      doRefresh(opts)
    }, 120)
  }, [doRefresh])

  const loadAdminMetrics = useCallback(async () => {
    try {
      const m = await api('/metrics')
      setAdminMetrics(m)
      setAdminMetricsError('')
    } catch (err) {
      setAdminMetricsError(err.status === 403 ? 'Necesitás rol de administrador.' : 'No se pudieron cargar las métricas.')
    }
  }, [])

  useEffect(() => {
    if (!currentUser) {
      setData({ customers: [], orders: [], users: [], technicians: [], config: null, catalog: { brands: [], models: [] } })
      setActividad([])
      setActividadError('')
      setAdminMetrics(null)
      setAdminMetricsError('')
      setLoading(false)
      return
    }
    refresh()
    if (currentUser.role === 'admin') loadAdminMetrics()

    // Canal de tiempo real: recibe avisos cuando algo cambió y recarga en silencio.
    const token = loadSession()?.token
    if (!token) return
    const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`)
    let connected = false
    es.addEventListener('connected', () => {
      connected = true
    })
    es.addEventListener('data-changed', () => {
      refresh({ silent: true })
      if (currentUser.role === 'admin') loadAdminMetrics()
    })
    es.onerror = () => {
      // Si ya llegamos a conectar y ahora la conexión falla, puede ser un
      // token expirado: validamos contra la API (refresh hace logout en 401).
      if (connected) refresh({ silent: true })
    }
    return () => es.close()
  }, [currentUser, refresh, loadAdminMetrics])

  // Ejecuta una mutación y refresca en silencio. Si el refresh falla no se
  // reporta como error: la mutación ya se aplicó (el SSE la sincroniza).
  const run = async (promise) => {
    let error = null
    try {
      await promise
    } catch (err) {
      error = err.message
    }
    if (!error) await refresh({ silent: true })
    return { error }
  }

  // Carga la vista paginada de órdenes (histórico) desde el servidor,
  // en lugar de traer todo el dataset en cada bootstrap.
  const loadOrders = useCallback(async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.q) params.set('q', filters.q)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    if (filters.brand && filters.brand !== 'all') params.set('brand', filters.brand)
    if (filters.onlyNotNotified) params.set('onlyNotNotified', '1')
    if (filters.onlyNotConfirmed) params.set('onlyNotConfirmed', '1')
    if (filters.limit) params.set('limit', String(filters.limit))
    if (filters.offset != null) params.set('offset', String(filters.offset))
    setOrdersLoading(true)
    try {
      const res = await api(`/orders?${params.toString()}`)
      const page = { orders: res.orders || [], total: res.total || 0 }
      setOrdersPage(page)
      return page
    } catch (err) {
      if (err.status === 401) logout()
    } finally {
      setOrdersLoading(false)
    }
  }, [logout])

  // ---------- Clientes ----------
  const addCustomer = async (fields) => {
    try {
      const res = await api('/customers', { method: 'POST', body: fields })
      await refresh({ silent: true })
      return { error: null, id: res.id }
    } catch (err) {
      return { error: err.message }
    }
  }
  const updateCustomer = (id, fields) =>
    run(api(`/customers/${id}`, { method: 'PUT', body: fields }))
  const deleteCustomer = (id) => run(api(`/customers/${id}`, { method: 'DELETE' }))

  // ---------- Catálogo ----------
  const addCatalogBrand = async (name) => {
    try {
      const res = await api('/catalog/brands', { method: 'POST', body: { name } })
      await refresh({ silent: true })
      return { error: null, brand: res.brand }
    } catch (err) {
      return { error: err.message }
    }
  }
  const addCatalogModel = async (brand, name) => {
    try {
      const res = await api('/catalog/models', { method: 'POST', body: { brand, name } })
      await refresh({ silent: true })
      return { error: null, model: res.model }
    } catch (err) {
      return { error: err.message }
    }
  }

  // ---------- Órdenes ----------
  const addOrder = async (fields) => {
    try {
      const res = await api('/orders', { method: 'POST', body: fields })
      await refresh({ silent: true })
      return { error: null, order: res.order }
    } catch (err) {
      return { error: err.message }
    }
  }

  const deleteOrder = (id) => run(api(`/orders/${id}`, { method: 'DELETE' }))

  // Cambia el estado de una orden.
  const setOrderStatus = async (orderId, status, extras = {}) => {
    try {
      const res = await api(`/orders/${orderId}/status`, { method: 'POST', body: { status, ...extras } })
      await refresh({ silent: true })
      return { error: null, order: res.order }
    } catch (err) {
      return { error: err.message }
    }
  }

  // Actualiza notas / presupuesto del técnico.
  const updateOrder = (orderId, fields) =>
    run(api(`/orders/${orderId}`, { method: 'PUT', body: fields }))

  // Marca / desmarca "cliente avisado".
  const toggleNotified = async (orderId, notified) => {
    try {
      const res = await api(`/orders/${orderId}/notified`, { method: 'POST', body: { notified } })
      await refresh({ silent: true })
      return { error: null, order: res.order }
    } catch (err) {
      return { error: err.message }
    }
  }

  // Marca / desmarca confirmación del cliente sobre el arreglo.
  const confirmOrder = async (orderId, confirmed) => {
    try {
      const res = await api(`/orders/${orderId}/confirm`, { method: 'POST', body: { confirmed } })
      await refresh({ silent: true })
      return { error: null, order: res.order }
    } catch (err) {
      return { error: err.message }
    }
  }

  // Asigna el técnico encargado de una orden.
  const assignTechnician = async (orderId, userId) => {
    try {
      const res = await api(`/orders/${orderId}/assign`, { method: 'POST', body: { userId } })
      await refresh({ silent: true })
      return { error: null, order: res.order }
    } catch (err) {
      return { error: err.message }
    }
  }

  // Imprime la etiqueta ZPL del equipo.
  const printLabel = async (orderId) => {
    try {
      const res = await api(`/orders/${orderId}/label`, { method: 'POST' })
      return { error: res.ok ? null : res.error }
    } catch (err) {
      return { error: err.message }
    }
  }

  // ---------- Actividad ----------
  const loadMoreActividad = async () => {
    const nextPage = Math.floor(actividad.length / ACTIVIDAD_PAGE_SIZE) + 1
    try {
      const act = await api(`/actividad?page=${nextPage}&limit=${ACTIVIDAD_PAGE_SIZE}`)
      setActividad((prev) => [...prev, ...(act.logs || [])])
      setActividadHasMore((act.page || 1) < (act.pages || 1))
    } catch {
      // Silencioso: el usuario puede reintentar con "Ver más".
    }
  }

  // ---------- Usuarios ----------
  const addUser = (fields) => run(api('/users', { method: 'POST', body: fields }))
  const toggleUserActive = (id) => run(api(`/users/${id}/toggle`, { method: 'POST' }))

  // ---------- Configuración ----------
  const saveConfig = async (fields) => run(api('/config', { method: 'POST', body: fields }))

  // ---------- Derivados / listas por estado ----------
  const derived = useMemo(() => {
    const byStatus = (s) => data.orders.filter((o) => o.status === s)

    const byLastActivity = (list) =>
      [...list].sort((a, b) => {
        const last = (o) => o.history?.[o.history.length - 1]?.at || o.createdAt
        return toTime(last(b)) - toTime(last(a))
      })

    return {
      readyOrders: byLastActivity(byStatus('terminado')),
      pendingBudgetOrders: byLastActivity(
        byStatus('presupuesto').filter((o) => !o.confirmed),
      ),
      porAvisarOrders: byLastActivity(
        data.orders.filter(
          (o) => ['presupuesto', 'terminado'].includes(o.status) && !o.notified,
        ),
      ),
      faltaRepuestosOrders: byLastActivity(byStatus('falta_repuestos')),
      ingresaronHoyOrders: data.orders.filter(
        (o) => o.createdAt && o.createdAt.slice(0, 10) === today,
      ),
    }
  }, [data.orders])

  const value = {
    loading,
    today,
    refresh,
    customers: data.customers,
    orders: data.orders,
    ordersPage: ordersPage.orders,
    ordersTotal: ordersPage.total,
    ordersLoading,
    loadOrders,
    ordersRevision,
    users: data.users,
    technicians: data.technicians,
    config: data.config,
    catalog: data.catalog,
    actividad,
    actividadHasMore,
    actividadError,
    adminMetrics,
    adminMetricsError,
    loadAdminMetrics,
    ...derived,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addCatalogBrand,
    addCatalogModel,
    addOrder,
    deleteOrder,
    setOrderStatus,
    updateOrder,
    toggleNotified,
    confirmOrder,
    assignTechnician,
    printLabel,
    loadMoreActividad,
    addUser,
    toggleUserActive,
    saveConfig,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>')
  return ctx
}