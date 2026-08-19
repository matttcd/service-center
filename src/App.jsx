// ============================================
// App: definición de rutas y guardas de acceso
// ============================================
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Orders from './pages/Orders.jsx'
import OrderDetail from './pages/OrderDetail.jsx'
import Clients from './pages/Clients.jsx'
import ClientDetail from './pages/ClientDetail.jsx'
import Users from './pages/Users.jsx'
import Backups from './pages/Backups.jsx'
import Actividad from './pages/Actividad.jsx'
import Settings from './pages/Settings.jsx'

// Protege rutas: sin sesión se redirige a /login.
function RequireAuth({ children }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

// Restringe rutas según rol.
function RequireRole({ role, children }) {
  const { currentUser } = useAuth()
  if (currentUser?.role !== role) return <Navigate to="/" replace />
  return children
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
        <Route index element={<Dashboard />} />
        <Route path="ordenes" element={<Orders />} />
        <Route path="ordenes/:id" element={<OrderDetail />} />
        <Route path="clientes" element={<Clients />} />
        <Route path="clientes/:id" element={<ClientDetail />} />
        <Route path="actividad" element={<Actividad />} />
        <Route
          path="usuarios"
          element={
            <RequireRole role="admin">
              <Users />
            </RequireRole>
          }
        />
        <Route
          path="backups"
          element={
            <RequireRole role="admin">
              <Backups />
            </RequireRole>
          }
        />
        <Route
          path="configuracion"
          element={
            <RequireRole role="admin">
              <Settings />
            </RequireRole>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}