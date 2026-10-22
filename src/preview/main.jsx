import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import NotificationProvider from '../components/NotificationProvider.jsx'
import '../index.css'
import './flow-preview.css'

// Esta entrada evita montar AuthProvider/DataProvider, incluso si hay una sesión real.
if (import.meta.env.DEV) {
  import('./FlowPreview.jsx').then(({ default: FlowPreview }) => {
    createRoot(document.getElementById('root')).render(
      <StrictMode><NotificationProvider><FlowPreview /></NotificationProvider></StrictMode>,
    )
  })
} else {
  document.getElementById('root').textContent = 'La vista previa está disponible solamente en desarrollo.'
}
