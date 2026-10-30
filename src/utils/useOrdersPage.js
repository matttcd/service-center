import { useEffect, useState } from 'react'
import { useData } from '../context/DataContext.jsx'
import { orderQuery } from './orderQuery.js'

export function useOrdersPage(filters) {
  const { loadOrders, getCachedOrders, ordersRevision } = useData()
  const key = orderQuery(filters).toString()
  const [state, setState] = useState(() => ({ key, data: getCachedOrders(filters), loading: true, error: '' }))
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    const query = Object.fromEntries(new URLSearchParams(key))
    setState((previous) => ({ key, data: getCachedOrders(query) || previous.data, loading: true, error: '' }))
    loadOrders(query).then((data) => {
      if (active) setState({ key, data, loading: false, error: '' })
    }).catch((error) => {
      if (active) setState((previous) => ({ ...previous, loading: false, error: error.message }))
    })
    return () => { active = false }
  }, [key, ordersRevision, retry, loadOrders, getCachedOrders])
  const current = state.key === key ? state : { data: getCachedOrders(filters) || state.data, loading: true, error: '' }
  return { ...current, retry: () => setRetry((value) => value + 1) }
}
