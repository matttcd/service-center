// ============================================
// Layout: estructura general con sidebar y contenido
// ============================================
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar.jsx'
import DashboardSkeleton from './DashboardSkeleton.jsx'
import ChangePasswordModal from './ChangePasswordModal.jsx'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { BRAND_NAME } from '../utils/brand.js'
import logoUrl from '../assets/gringologo-modified.png'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { loading, dataError, refresh } = useData()
  const { currentUser, clearMustChangePassword } = useAuth()

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Barra superior en móvil */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 lg:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="Logo" className="h-7 w-7 rounded-full object-contain" />
          <span className="text-sm font-bold text-slate-900 dark:text-white">{BRAND_NAME}</span>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="px-4 py-6 sm:px-6 lg:ml-64 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {dataError && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            <p>No se pudieron actualizar los datos: {dataError}</p>
            <button onClick={() => refresh({ immediate: true })} className="shrink-0 font-semibold underline">Reintentar</button>
          </div>}
          {loading ? (
            <DashboardSkeleton />
          ) : (
            <div className="animate-fade-in">
              <Outlet />
            </div>
          )}
        </div>
      </main>

      {currentUser?.mustChangePassword && (
        <ChangePasswordModal open onDone={clearMustChangePassword} />
      )}
    </div>
  )
}
