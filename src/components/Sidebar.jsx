// ============================================
// Sidebar: navegación lateral responsive
// ============================================
import { NavLink } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Settings,
  UserCog,
  Database,
  Sun,
  Moon,
  LogOut,
  X,
  History,
  Wrench,
  PackageCheck,
  BarChart3,
  ChevronDown,
  RefreshCw,
  Check,
  ShieldCheck,
  Shield,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../utils/api.js'
import ProfileSwitchModal from './ProfileSwitchModal.jsx'
import { usePendingDrafts } from '../context/workspace.js'
import { BRAND_NAME, BRAND_SUBTITLE } from '../utils/brand.js'
import logoUrl from '../assets/gringologo-modified.png'
import { ROLE_LABEL } from '../utils/helpers.js'

function RoleIcon({ role }) {
  if (role === 'admin') return <ShieldCheck size={12} />
  if (role === 'tecnico') return <Wrench size={12} />
  return <Shield size={12} />
}

export default function Sidebar({ open, onClose }) {
  const { currentUser, logout } = useAuth()
  const role = currentUser?.role
  const isAdmin = role === 'admin'
  const isTech = role === 'tecnico' || isAdmin
  const [profiles, setProfiles] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [switchTarget, setSwitchTarget] = useState(null)
  const menuRef = useRef(null)

  const loadProfiles = async () => {
    setLoadError('')
    setLoadingProfiles(true)
    try {
      const res = await api('/auth/profiles')
      setProfiles(res.profiles || [])
    } catch {
      setLoadError('No se pudieron cargar los perfiles.')
    } finally {
      setLoadingProfiles(false)
    }
  }

  const openMenu = () => {
    setMenuOpen((v) => !v)
    if (profiles.length === 0) loadProfiles()
  }

  const pick = (p) => {
    if (p.id === currentUser?.id) return setMenuOpen(false)
    setMenuOpen(false)
    if (leave()) setSwitchTarget(p)
  }

  // Cierra el menú con click afuera o Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const initials = (name) =>
    String(name || '')
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('')

  const pendingDrafts = usePendingDrafts()
  const leave = () => !pendingDrafts || window.confirm('Hay borradores sin guardar. ¿Descartarlos y salir?')
  const groups = [
    { label: 'Trabajo', items: [
      ...(!isTech || isAdmin ? [{ to: '/recepcion', label: 'Recepción', icon: ClipboardList }] : []),
      { to: '/taller', label: 'Taller', icon: Wrench },
      { to: '/terminados', label: 'Terminados', icon: PackageCheck },
    ] },
    { label: 'Consultas', items: [
      ...(!isTech || isAdmin ? [{ to: '/resumen', label: 'Resumen', icon: LayoutDashboard }] : []),
      { to: '/ordenes', label: 'Órdenes', icon: ClipboardList },
      ...(!isTech || isAdmin ? [{ to: '/clientes', label: 'Clientes', icon: Users }] : []),
      { to: '/actividad', label: 'Actividad', icon: History },
      ...(isAdmin ? [{ to: '/metricas', label: 'Métricas', icon: BarChart3 }] : []),
    ] },
    { label: 'Administración', items: [
      ...(isAdmin ? [
        { to: '/usuarios', label: 'Usuarios', icon: UserCog },
        { to: '/backups', label: 'Copias de seguridad', icon: Database },
        { to: '/papelera', label: 'Papelera', icon: Trash2 },
        { to: '/configuracion', label: 'Configuración', icon: Settings },
      ] : []),
      { to: '/ajustes', label: 'Ajustes', icon: Settings },
    ] },
  ]
  return (
    <>
      {/* Overlay para móvil */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 sc-sidebar flex flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Marca */}
        <div className="flex items-center justify-between gap-2 px-3 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <img src={logoUrl} alt="Logo" className="h-9 w-9 shrink-0 rounded-full object-contain" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white">{BRAND_NAME}</p>
              <p className="text-[11px] font-semibold text-accent-600 dark:text-accent-400">{BRAND_SUBTITLE}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1"><ThemeToggle /><button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button></div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {groups.map((group) => <div key={group.label}><p className="sc-nav-group">{group.label}</p>{group.items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => `sc-nav-link ${isActive ? 'active' : ''}`}><Icon size={18} />{label}</NavLink>)}</div>)}
        </nav>

        <div className="sc-profile-footer border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="sc-profile-row"><div ref={menuRef} className="relative">
            <button className="sc-profile-button" onClick={openMenu} aria-expanded={menuOpen} aria-label="Cambiar de perfil"><span className="ws-avatar">{initials(currentUser?.name)}</span><span><strong>{currentUser?.name}</strong><small>{ROLE_LABEL[role]}</small></span><ChevronDown size={14} /></button>
            {menuOpen && <div className="absolute bottom-full left-0 z-50 mb-2 w-72 max-h-[70dvh] overflow-y-auto max-w-[calc(100vw-24px)] rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900" role="menu" aria-label="Perfiles">
              <p className="px-2 py-1 text-sm">Cambiar de perfil</p>
              {loadingProfiles ? <p className="p-2">Cargando perfiles…</p> : loadError ? <div className="p-2"><p>{loadError}</p><button onClick={loadProfiles} className="ws-button"><RefreshCw size={14} />Reintentar</button></div> : profiles.length === 0 ? <p className="p-2">No hay perfiles disponibles.</p> : profiles.map((profile) => <button key={profile.id} role="menuitem" disabled={profile.id === currentUser?.id} onClick={() => pick(profile)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-70"><span className="ws-avatar">{initials(profile.name)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{profile.name}</strong><span className="flex items-center gap-1 text-sm"><RoleIcon role={profile.role} />{ROLE_LABEL[profile.role]}</span></span>{profile.id === currentUser?.id && <Check size={16} />}</button>)}
            </div>}
          </div><button className="ws-icon-button" onClick={() => { if (leave()) logout() }} aria-label="Salir" title="Salir"><LogOut size={18} /></button></div>
        </div>
      </aside>

      <ProfileSwitchModal profile={switchTarget} onClose={() => setSwitchTarget(null)} />
    </>
  )
}

// Toggle de tema claro/oscuro persistido en localStorage.
function ThemeToggle() {
  const [mode, setMode] = useState(
    () => document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  const toggle = () => {
    const next = mode === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    localStorage.setItem('service_theme_v1', next)
    setMode(next)
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      title={mode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={mode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
