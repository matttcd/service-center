import { useRef, useState } from 'react'

export function useFormDraft(initial, draft, onChange) {
  const [defaults] = useState(initial)
  const [local, setLocal] = useState(defaults)
  const fields = { ...defaults, ...(onChange ? draft : local) }
  const current = useRef(fields)
  current.current = fields
  const patch = (values) => {
    current.current = { ...current.current, ...values }
    const empty = Object.keys(defaults).every((key) => JSON.stringify(current.current[key]) === JSON.stringify(defaults[key]))
    if (onChange) onChange(empty ? undefined : current.current)
    else setLocal(current.current)
  }
  const clear = () => { current.current = defaults; if (onChange) onChange(undefined); else setLocal(defaults) }
  return [fields, patch, clear]
}
