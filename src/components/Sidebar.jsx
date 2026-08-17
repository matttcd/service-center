// ============================================
// Sidebar: navegación lateral responsive
// ============================================
import { NavLink } from 'react-router-dom'
import { useState } from 'react'
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
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { BRAND_NAME, BRAND_SUBTITLE } from '../utils/brand.js'
import { ROLE_LABEL } from '../utils/helpers.js'

export default function Sidebar({ open, onClose }) {
  const { currentUser, logout } = useAuth()
  const role = currentUser?.role
  const isAdmin = role === 'admin'

  // Ítems de navegación según el rol.
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/ordenes', label: 'Órdenes', icon: ClipboardList, end: false },
    ...(role === 'mostrador' || isAdmin
      ? [{ to: '/clientes', label: 'Clientes', icon: Users, end: false }]
      : []),
    { to: '/actividad', label: 'Actividad', icon: History, end: false },
    ...(isAdmin
      ? [
          { to: '/usuarios', label: 'Usuarios', icon: UserCog, end: false },
          { to: '/backups', label: 'Copias de seguridad', icon: Database, end: false },
          { to: '/configuracion', label: 'Configuración', icon: Settings, end: false },
        ]
      : []),
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-400 text-primary-600">
              <span className="text-2xl font-black leading-none">G</span>
            </div>
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
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600 dark:bg-primary-500/15 dark:text-primary-400">
              {currentUser?.name
                .split(' ')
                .slice(0, 2)
                .map((w) => w[0].toUpperCase())
                .join('')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {currentUser?.name}
              </p>
              <p className="truncate text-xs capitalize text-slate-400">
                {ROLE_LABEL[role] || role}
              </p>
            </div>
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