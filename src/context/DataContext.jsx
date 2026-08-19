// ============================================
// Contexto global de datos (obtenidos de la API)
// ============================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../utils/api.js'
import { useAuth } from './AuthContext.jsx'
import { todayISO } from '../utils/helpers.js'

const DataContext = createContext(null)

const ACTIVIDAD_PAGE_SIZE = 50

export function DataProvider({ children }) {
  const { currentUser, logout } = useAuth()
  const [data, setData] = useState({
    customers: [],
    orders: [],
    users: [],
    config: null,
    catalog: { brands: [], models: [] },
  })
  const [actividad, setActividad] = useState([])
  const [actividadHasMore, setActividadHasMore] = useState(false)
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

  useEffect(() => {
    if (!currentUser) {
      setData({ customers: [], orders: [], users: [], config: null, catalog: { brands: [], models: [] } })
      setActividad([])
      setLoading(false)
      return
    }
    refresh()
  }, [currentUser, refresh])

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

  // ---------- Derivados / métricas ----------
  const derived = useMemo(() => {
    const receivedToday = data.orders.filter((o) => o.createdAt === today).length
    const deliveredToday = data.orders.filter((o) => o.deliveredAt === today).length

    const byStatus = (s) => data.orders.filter((o) => o.status === s)

    const byLastActivity = (list) =>
      [...list].sort((a, b) => {
        const last = (o) => o.history?.[o.history.length - 1]?.at || o.createdAt
        return String(last(b)).localeCompare(String(last(a)))
      })

    return {
      metrics: {
        receivedToday,
        inRevisionCount: byStatus('en_revision').length,
        pendingBudgetCount: byStatus('presupuesto').length,
        inRepairCount: byStatus('en_reparacion').length,
        readyCount: byStatus('terminado').length,
        deliveredToday,
      },
      readyOrders: byLastActivity(byStatus('terminado')),
      pendingBudgetOrders: byLastActivity(byStatus('presupuesto')),
    }
  }, [data.orders, today])

  const value = {
    loading,
    today,
    refresh,
    customers: data.customers,
    orders: data.orders,
    users: data.users,
    config: data.config,
    catalog: data.catalog,
    actividad,
    actividadHasMore,
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