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
  AlertCircle,
  ShieldCheck,
  Shield,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../utils/api.js'
import ProfileSwitchModal from './ProfileSwitchModal.jsx'
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
    setSwitchTarget(p)
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

  // Ítems de navegación según el rol.
  const navItems = isAdmin
    ? [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/ordenes', label: 'Órdenes', icon: ClipboardList, end: false },
        { to: '/taller', label: 'Taller', icon: Wrench, end: false },
        { to: '/listos', label: 'Listos', icon: PackageCheck, end: false },
        { to: '/clientes', label: 'Clientes', icon: Users, end: false },
        { to: '/actividad', label: 'Actividad', icon: History, end: false },
        { to: '/metricas', label: 'Métricas', icon: BarChart3, end: false },
        { to: '/usuarios', label: 'Usuarios', icon: UserCog, end: false },
        { to: '/backups', label: 'Copias de seguridad', icon: Database, end: false },
        { to: '/configuracion', label: 'Configuración', icon: Settings, end: false },
      ]
    : isTech
      ? [
          { to: '/taller', label: 'Taller', icon: Wrench, end: false },
          { to: '/listos', label: 'Listos', icon: PackageCheck, end: false },
          { to: '/ordenes', label: 'Órdenes', icon: ClipboardList, end: false },
          { to: '/actividad', label: 'Actividad', icon: History, end: false },
        ]
      : [
          { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
          { to: '/ordenes', label: 'Órdenes', icon: ClipboardList, end: false },
          { to: '/taller', label: 'Taller', icon: Wrench, end: false },
          { to: '/clientes', label: 'Clientes', icon: Users, end: false },
          { to: '/actividad', label: 'Actividad', icon: History, end: false },
        ]

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      isActive
        ? 'bg-primary-600 text-white shadow-sm'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
    }`

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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Marca */}
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo" className="h-9 w-9 rounded-full object-contain" />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{BRAND_NAME}</p>
              <p className="text-[11px] font-semibold text-accent-600 dark:text-accent-400">{BRAND_SUBTITLE}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onClose} className={linkCls}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Usuario + acciones */}
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div ref={menuRef} className="relative">
            <button
              onClick={openMenu}
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                menuOpen ? 'bg-slate-50 dark:bg-slate-800/50' : ''
              }`}
              title="Cambiar de perfil"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600 dark:bg-primary-500/15 dark:text-primary-400">
                {initials(currentUser?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {currentUser?.name}
                </p>
                <p className="truncate text-xs capitalize text-slate-400">
                  {ROLE_LABEL[role] || role}
                </p>
              </div>
              <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div className="absolute inset-x-0 bottom-full z-20 mb-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                {loadingProfiles ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400">
                    <RefreshCw size={14} className="animate-spin" />
                    Cargando perfiles…
                  </div>
                ) : loadError ? (
                  <div className="px-3 py-2 text-center">
                    <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                      <AlertCircle size={14} />
                      No se pudieron cargar los perfiles.
                    </p>
                    <button
                      onClick={loadProfiles}
                      className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700"
                    >
                      <RefreshCw size={12} />
                      Reintentar
                    </button>
                  </div>
                ) : profiles.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-400">No hay otros perfiles.</p>
                ) : (
                  profiles.map((p) => {
                    const isCurrent = p.id === currentUser?.id
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => pick(p)}
                        disabled={isCurrent}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                          isCurrent
                            ? 'cursor-default bg-primary-50 dark:bg-primary-500/10'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isCurrent
                              ? 'bg-primary-600 text-white'
                              : 'bg-primary-100 text-primary-600 dark:bg-primary-500/15 dark:text-primary-400'
                          }`}
                        >
                          {initials(p.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-semibold ${isCurrent ? 'text-primary-800 dark:text-primary-300' : 'text-slate-700 dark:text-slate-200'}`}>
                            {p.name}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              p.role === 'admin'
                                ? 'text-primary-600 dark:text-primary-400'
                                : p.role === 'tecnico'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-400 dark:text-slate-400'
                            }`}
                          >
                            <RoleIcon role={p.role} />
                            {ROLE_LABEL[p.role] || p.role}
                          </span>
                        </div>
                        {isCurrent && <span className="text-[10px] font-semibold text-primary-600 dark:text-primary-400">Activo</span>}
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={logout}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-500/10"
            >
              <LogOut size={16} />
              Salir
            </button>
          </div>
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
    >
      {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}