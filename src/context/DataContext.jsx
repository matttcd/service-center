// ============================================
// Contexto global de datos (obtenidos de la API)
// ============================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../utils/api.js'
import { useAuth } from './AuthContext.jsx'
import { todayISO, orderStatus } from '../utils/helpers.js'

const DataContext = createContext(null)

const ACTIVIDAD_PAGE_SIZE = 50

export function DataProvider({ children }) {
  const { currentUser, logout } = useAuth()
  const [data, setData] = useState({
    customers: [],
    orders: [],
    users: [],
    config: null,
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
      setData({ customers: [], orders: [], users: [], config: null })
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

  // Cambia el estado de un equipo. Devuelve la orden actualizada.
  const setItemStatus = async (orderId, itemId, status) => {
    try {
      const res = await api(`/orders/${orderId}/items/${itemId}/status`, {
        method: 'POST',
        body: { status },
      })
      await refresh({ silent: true })
      return { error: null, order: res.order, whatsapp: res.whatsapp }
    } catch (err) {
      return { error: err.message }
    }
  }

  // Actualiza notas / precio del técnico.
  const updateItem = (orderId, itemId, fields) =>
    run(api(`/orders/${orderId}/items/${itemId}`, { method: 'PUT', body: fields }))

  // Imprime la etiqueta ZPL del equipo.
  const printItemLabel = async (orderId, itemId) => {
    try {
      const res = await api(`/orders/${orderId}/items/${itemId}/label`, { method: 'POST' })
      return { error: res.ok ? null : res.error }
    } catch (err) {
      return { error: err.message }
    }
  }

  // Reenvía el aviso de WhatsApp.
  const notifyItem = async (orderId, itemId) => {
    try {
      const res = await api(`/orders/${orderId}/items/${itemId}/notify`, { method: 'POST' })
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

  // ---------- Configuración de WhatsApp ----------
  const saveWhatsAppConfig = async (fields) => {
    const res = await run(api('/config/whatsapp', { method: 'POST', body: fields }))
    return res
  }

  // ---------- Derivados / métricas ----------
  const derived = useMemo(() => {
    const receivedToday = data.orders.filter((o) => o.createdAt === today).length

    const inRepair = data.orders.filter((o) => orderStatus(o) === 'en_reparacion')
    const ready = data.orders.filter((o) => orderStatus(o) === 'lista')

    const readyItems = data.orders
      .flatMap((o) =>
        (o.items || []).filter((i) => i.status === 'terminado').map((i) => ({ order: o, item: i })),
      )
      .sort((a, b) => String(b.item.createdAt).localeCompare(String(a.item.createdAt)))

    const deliveredToday = data.orders.filter((o) =>
      (o.items || []).some((i) => i.deliveredAt === today),
    ).length

    return {
      metrics: {
        receivedToday,
        inRepairCount: inRepair.length,
        readyCount: ready.length,
        deliveredToday,
      },
      readyItems,
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
    actividad,
    actividadHasMore,
    ...derived,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addOrder,
    deleteOrder,
    setItemStatus,
    updateItem,
    printItemLabel,
    notifyItem,
    loadMoreActividad,
    addUser,
    toggleUserActive,
    saveWhatsAppConfig,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>')
  return ctx
}