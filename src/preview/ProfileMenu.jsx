import { useEffect, useRef, useState } from 'react'
import { ChevronDown, UserRound } from 'lucide-react'
import { PROFILES } from './system-model.js'

const initials = (name) => name.split(' ').map((word) => word[0]).join('')

export default function ProfileMenu({ role, onChange, compact = false }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null), trigger = useRef(null)
  useEffect(() => {
    if (!open) return
    root.current.querySelector('.fp-profile-options button:not(:disabled)')?.focus()
    const outside = (event) => { if (!root.current.contains(event.target)) setOpen(false) }
    const escape = (event) => { if (event.key === 'Escape') { setOpen(false); trigger.current.focus() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  return <div className={`fp-profile-menu ${compact ? 'fp-profile-menu-mobile' : ''}`} ref={root}>
    <button ref={trigger} className={compact ? 'fp-button secondary' : 'fp-person'} aria-label="Cambiar de perfil" aria-expanded={open} onClick={() => setOpen(!open)}>
      {compact ? <UserRound size={18} /> : <><span className="fp-avatar">{initials(PROFILES[role].name)}</span><span>{PROFILES[role].name}<span>{PROFILES[role].label}</span></span><ChevronDown size={16} /></>}
    </button>
    {open && <div className="fp-profile-options" role="group" aria-label="Cambiar de perfil"><p>Cambiar de perfil</p>{Object.entries(PROFILES).map(([key, profile]) => <button key={key} disabled={role === key} onClick={() => { setOpen(false); onChange(key) }}><span className="fp-avatar">{initials(profile.name)}</span><span>{profile.name}<span>{profile.label}</span></span>{role === key && <span className="fp-profile-active">Activo</span>}</button>)}</div>}
  </div>
}
