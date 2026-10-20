import { createContext, useCallback, useContext, useRef } from 'react'

export const NotificationContext = createContext(null)

export function useNotify(defaultType = 'info') {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('Las notificaciones requieren NotificationProvider.')
  const { show, dismiss } = context
  const current = useRef(null)
  return useCallback((value, options = {}) => {
    if (!value) { if (current.current) dismiss(current.current); current.current = null; return }
    const message = typeof value === 'string' ? value : value.text || value.msg
    if (!message) return
    const type = typeof value === 'object'
      ? value.error || value.type === 'error' ? 'error' : value.type === 'ok' ? 'success' : value.type || defaultType
      : defaultType
    current.current = show({ message, type, ...options }, current.current)
  }, [show, dismiss, defaultType])
}
