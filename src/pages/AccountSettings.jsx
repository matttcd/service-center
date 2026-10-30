import { useState } from 'react'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import ChangePasswordModal from '../components/ChangePasswordModal.jsx'
import Card from '../components/Card.jsx'
import PageHeading from '../components/PageHeading.jsx'
import { ROLE_LABEL } from '../utils/helpers.js'

export default function AccountSettings({ embedded = false }) {
  const { currentUser, clearMustChangePassword } = useAuth()
  const [open, setOpen] = useState(false)
  return <div className="space-y-6">
    {!embedded && <PageHeading title="Ajustes" />}
    <Card className="sc-account">
      <header className="sc-account-heading"><span className="ws-avatar" aria-hidden="true">{currentUser.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('')}</span><h2>Mi cuenta</h2></header>
      <dl className="sc-account-details">
        <div><dt>Nombre</dt><dd>{currentUser.name}</dd></div>
        <div><dt><ShieldCheck size={16} aria-hidden="true" />Perfil</dt><dd>{ROLE_LABEL[currentUser.role]}</dd></div>
        {currentUser.email && <div><dt><Mail size={16} aria-hidden="true" />Correo electrónico</dt><dd>{currentUser.email}</dd></div>}
      </dl>
      <section className="sc-account-security" aria-label="Seguridad"><h2><KeyRound size={16} aria-hidden="true" />Contraseña de acceso</h2><button className="ws-button" onClick={() => setOpen(true)}>Cambiar contraseña</button></section>
    </Card>
    <ChangePasswordModal open={open} required={false} onClose={() => setOpen(false)} onDone={(token) => { clearMustChangePassword(token); setOpen(false) }} />
  </div>
}
