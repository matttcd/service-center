// ============================================
// Contexto global de datos (obtenidos de la API)
// ============================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../utils/api.js'
import { useAuth } from './AuthContext.jsx'
import { loadSession } from '../utils/storage.js'
import { todayISO } from '../utils/helpers.js'

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
  const [adminMetrics, setAdminMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const today = todayISO()

  const refresh = useCallback(async ({ silent = false } = {}) => {
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
        setActividad(act.logs || [])
        setActividadHasMore((act.page || 1) < (act.pages || 1))
      } catch {
        setActividad([])
        setActividadHasMore(false)
      }
    } catch (err) {
      if (err.status === 401) logout()
    } finally {
      if (!silent) setLoading(false)
    }
  }, [logout])

  const loadAdminMetrics = useCallback(async () => {
    try {
      const m = await api('/metrics')
      setAdminMetrics(m)
    } catch {
      // Silencioso: la página de métricas muestra estado vacío.
    }
  }, [])

  useEffect(() => {
    if (!currentUser) {
      setData({ customers: [], orders: [], users: [], technicians: [], config: null, catalog: { brands: [], models: [] } })
      setActividad([])
      setAdminMetrics(null)
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
    es.addEventListener('data-changed', () => refresh({ silent: true }))
    es.onerror = () => {
      // Si ya llegamos a conectar y ahora la conexión falla, puede ser un
      // token expirado: validamos contra la API (refresh hace logout en 401).
      if (connected) refresh({ silent: true })
    }
    return () => es.close()
  }, [currentUser, refresh, loadAdminMetrics])

  const run = async (promise) => {
    try {
      await promise
      await refresh({ silent: true })
      return { error: null }
    } catch (err) {
      return { error: err.message }
    }
  }

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
  const setOrderStatus = async (orderId, status) => {
    try {
      const res = await api(`/orders/${orderId}/status`, { method: 'POST', body: { status } })
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
        return String(last(b)).localeCompare(String(last(a)))
      })

    return {
      readyOrders: byLastActivity(byStatus('terminado')),
      pendingBudgetOrders: byLastActivity(byStatus('presupuesto')),
      porAvisarOrders: byLastActivity(
        data.orders.filter(
          (o) => ['presupuesto', 'terminado'].includes(o.status) && !o.notified,
        ),
      ),
    }
  }, [data.orders, today])

  const value = {
    loading,
    today,
    refresh,
    customers: data.customers,
    orders: data.orders,
    users: data.users,
    technicians: data.technicians,
    config: data.config,
    catalog: data.catalog,
    actividad,
    actividadHasMore,
    adminMetrics,
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