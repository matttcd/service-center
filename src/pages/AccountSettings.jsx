import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import ChangePasswordModal from '../components/ChangePasswordModal.jsx'
import Card from '../components/Card.jsx'
import { ROLE_LABEL } from '../utils/helpers.js'

export default function AccountSettings() {
  const { currentUser, clearMustChangePassword } = useAuth()
  const [open, setOpen] = useState(false)
  return <div className="space-y-6"><h1 className="text-lg font-bold">Ajustes</h1><Card className="p-5 space-y-4"><div className="flex items-center gap-3"><span className="ws-avatar">{currentUser.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('')}</span><div><p className="font-bold">{currentUser.name}</p><p>{ROLE_LABEL[currentUser.role]}</p></div></div><button className="ws-button" onClick={() => setOpen(true)}><KeyRound size={16} />Cambiar contraseña</button></Card><ChangePasswordModal open={open} required={false} onClose={() => setOpen(false)} onDone={(token) => { clearMustChangePassword(token); setOpen(false) }} /></div>
}
