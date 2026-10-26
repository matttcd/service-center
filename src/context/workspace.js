import { createContext, useCallback, useContext, useState } from 'react'
export const WorkspaceContext = createContext(null)

export function useWorkspaceState(key, initial) {
  const context = useContext(WorkspaceContext)
  const [fallback, setFallback] = useState(initial)
  const value = context?.state[key] ?? fallback
  const write = context?.write
  const setValue = useCallback((next) => write ? write(key, (previous) => typeof next === 'function' ? next(previous ?? fallback) : next) : setFallback(next), [write, key, fallback])
  return [value, setValue]
}

export function useOrderDraft(id) {
  const [draft, setDraft] = useWorkspaceState(`draft:${id}`, {})
  return [draft, (patch) => setDraft((previous) => {
    const next = { ...previous, ...patch }
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key]
    return Object.keys(next).length ? next : undefined
  }), () => setDraft(undefined)]
}

export function usePendingDrafts() { return useContext(WorkspaceContext)?.dirty || false }
