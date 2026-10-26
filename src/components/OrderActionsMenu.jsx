import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

export default function OrderActionsMenu({ label = 'Acciones', className = 'ws-action-menu', children }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef(null), menu = useRef(null)
  const close = () => { setOpen(false); trigger.current?.focus() }
  useLayoutEffect(() => {
    if (!open) return
    const anchor = trigger.current.getBoundingClientRect(), panel = menu.current
    const width = Math.min(224, window.innerWidth - 24)
    panel.style.width = `${width}px`
    panel.style.left = `${Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12))}px`
    panel.style.top = `${anchor.bottom + panel.offsetHeight + 6 <= window.innerHeight - 12 ? anchor.bottom + 6 : Math.max(12, anchor.top - panel.offsetHeight - 6)}px`
    panel.querySelector('button')?.focus()
    const outside = (event) => { if (!panel.contains(event.target) && !trigger.current.contains(event.target)) setOpen(false) }
    const reposition = (event) => { if (!(event.target instanceof Node) || !panel.contains(event.target)) setOpen(false) }
    window.addEventListener('pointerdown', outside)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true) }
  }, [open])
  const keyboard = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (event.key === 'Tab') { close(); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const items = [...menu.current.querySelectorAll('button')], current = items.indexOf(document.activeElement)
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[index]?.focus()
  }
  return <><button ref={trigger} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) } }}>{label}<ChevronDown size={13} /></button>
    {open && createPortal(<div className={className} ref={menu} role="menu" aria-label="Acciones de la orden" onKeyDown={keyboard} onClick={(event) => { if (event.target.closest('button')) close() }}>{children}</div>, document.body)}
  </>
}
