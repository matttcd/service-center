import { useEffect, useRef } from 'react'

export default function Tabs({ id, label, items, value, onChange, panelId }) {
  const strip = useRef(null)
  useEffect(() => {
    const container = strip.current
    if (!container || container.scrollWidth <= container.clientWidth) return
    const selected = container.querySelector('[aria-selected=true]')?.getBoundingClientRect()
    if (!selected) return
    const bounds = container.getBoundingClientRect()
    container.scrollLeft += Math.min(0, selected.left - bounds.left) + Math.max(0, selected.right - bounds.right)
  }, [value])
  const onKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const current = items.findIndex((item) => item.key === value)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    onChange(items[next].key)
    event.currentTarget.querySelectorAll('[role=tab]')[next].focus()
  }
  return <div className="sc-tab-strip" ref={strip}><div className="sc-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
    {items.map(({ key, label: title, Icon, count }) => <button key={key} type="button" id={`${id}-${key}`} role="tab" aria-selected={value === key} aria-controls={panelId} tabIndex={value === key ? 0 : -1} onClick={() => onChange(key)}>
      {Icon && <Icon size={16} aria-hidden="true" />}<span>{title}</span>{count !== undefined && <span className="sc-tab-count">{count}</span>}
    </button>)}
  </div></div>
}
