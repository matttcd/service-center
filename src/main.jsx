// ============================================
// Punto de entrada de la aplicación
// ============================================
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './components/patternlock.css'
import App from './App.jsx'
import { DataProvider } from './context/DataContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { loadTheme } from './utils/storage.js'

// Aplica el tema guardado antes de renderizar (evita el flash de color).
const theme = loadTheme()
if (theme === 'dark') document.documentElement.classList.add('dark')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <DataProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  </StrictMode>,
)
