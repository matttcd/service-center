// ============================================
// App: definición de rutas y guardas de acceso
// ============================================
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Taller from './pages/Taller.jsx'
import Terminados from './pages/Terminados.jsx'
import Orders from './pages/Orders.jsx'
import OrderDetail from './pages/OrderDetail.jsx'
import Clients from './pages/Clients.jsx'
import ClientDetail from './pages/ClientDetail.jsx'
import Users from './pages/Users.jsx'
import Backups from './pages/Backups.jsx'
import Actividad from './pages/Actividad.jsx'
import Settings from './pages/Settings.jsx'
import Metrics from './pages/Metrics.jsx'

// Protege rutas: sin sesión se redirige a /login.
function RequireAuth({ children }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

// Restringe rutas según rol (acepta uno o varios roles).
function RequireRole({ roles, children }) {
  const { currentUser } = useAuth()
  const allowed = Array.isArray(roles) ? roles : [roles]
  if (!allowed.includes(currentUser?.role)) return <Navigate to="/" replace />
  return children
}

// Home: el técnico entra directo a su tablero del Taller.
function Home() {
  const { currentUser } = useAuth()
  if (currentUser?.role === 'tecnico') return <Navigate to="/taller" replace />
  return <Dashboard />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route
          path="taller"
          element={
            <RequireRole roles={['tecnico', 'admin', 'recepcion']}>
              <Taller />
            </RequireRole>
          }
        />
        <Route
          path="terminados"
          element={
            <RequireRole roles={['tecnico', 'admin']}>
              <Terminados />
            </RequireRole>
          }
        />
        <Route path="ordenes" element={<Orders />} />
        <Route path="ordenes/:id" element={<OrderDetail />} />
        <Route path="clientes" element={<Clients />} />
        <Route path="clientes/:id" element={<ClientDetail />} />
        <Route path="actividad" element={<Actividad />} />
        <Route
          path="usuarios"
          element={
            <RequireRole roles={['admin']}>
              <Users />
            </RequireRole>
          }
        />
        <Route
          path="backups"
          element={
            <RequireRole roles={['admin']}>
              <Backups />
            </RequireRole>
          }
        />
        <Route
          path="metricas"
          element={
            <RequireRole roles={['admin']}>
              <Metrics />
            </RequireRole>
          }
        />
        <Route
          path="configuracion"
          element={
            <RequireRole roles={['admin']}>
              <Settings />
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}