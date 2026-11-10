import { useState } from 'react'
import { KeyRound, Mail, Monitor, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import ChangePasswordModal from '../components/ChangePasswordModal.jsx'
import { ROLE_LABEL } from '../utils/helpers.js'
import { loadTheme, saveTheme } from '../utils/storage.js'

export default function AccountSettings() {
  const { currentUser, clearMustChangePassword } = useAuth()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState(loadTheme)
  return <div className="sc-account">
      <header className="sc-account-heading"><span className="ws-avatar" aria-hidden="true">{currentUser.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('')}</span><h2>Mi cuenta</h2></header>
      <dl className="sc-account-details">
        <div><dt>Nombre</dt><dd>{currentUser.name}</dd></div>
        <div><dt><ShieldCheck size={16} aria-hidden="true" />Perfil</dt><dd>{ROLE_LABEL[currentUser.role]}</dd></div>
        {currentUser.email && <div><dt><Mail size={16} aria-hidden="true" />Correo electrónico</dt><dd>{currentUser.email}</dd></div>}
      </dl>
      <div className="sc-account-row">
        <label htmlFor="account-theme"><Monitor size={16} aria-hidden="true" />Tema</label>
        <select id="account-theme" className="ws-button" value={theme} onChange={(event) => {
          const next = event.target.value
          saveTheme(next)
          document.documentElement.classList.toggle('dark', next === 'dark')
          setTheme(next)
        }}><option value="light">Claro</option><option value="dark">Oscuro</option></select>
      </div>
      <div className="sc-account-row"><h2><KeyRound size={16} aria-hidden="true" />Contraseña de acceso</h2><button className="ws-button" onClick={() => setOpen(true)}>Cambiar contraseña</button></div>
    <ChangePasswordModal open={open} required={false} onClose={() => setOpen(false)} onDone={(token) => { clearMustChangePassword(token); setOpen(false) }} />
  </div>
}
