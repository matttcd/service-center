export function orderQuery(filters = {}) {
  const params = new URLSearchParams()
  for (const key of ['status', 'brand', 'deviceType']) if (filters[key] && filters[key] !== 'all') params.set(key, filters[key])
  for (const key of ['q', 'from', 'to', 'customerId']) if (filters[key]) params.set(key, filters[key])
  for (const key of ['onlyNotNotified', 'onlyNotified', 'onlyNotConfirmed']) if (filters[key]) params.set(key, '1')
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))
  return params
}
