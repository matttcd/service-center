import { useCallback, useEffect, useState } from 'react'
import { WorkspaceContext } from './workspace.js'


// Solo memoria de la sesión: nunca persiste PIN ni datos del cliente en disco.
export function WorkspaceProvider({ children }) {
  const [state, setState] = useState({})
  const write = useCallback((key, value) => setState((previous) => {
    const next = typeof value === 'function' ? value(previous[key]) : value
    if (next === previous[key]) return previous
    const result = { ...previous }
    if (next === undefined) delete result[key]
    else result[key] = next
    return result
  }), [])
  const dirty = Object.keys(state).some((key) => key.startsWith('draft:'))
  useEffect(() => {
    if (!dirty) return
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  return <WorkspaceContext.Provider value={{ state, write, dirty }}>{children}</WorkspaceContext.Provider>
}
