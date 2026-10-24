import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import NotificationProvider from '../components/NotificationProvider.jsx'
import '../index.css'
import './flow-preview.css'

// Esta entrada evita montar AuthProvider/DataProvider, incluso si hay una sesión real.
if (import.meta.env.DEV) {
  document.body.classList.add('fp-preview')
  import('./FlowPreview.jsx').then(({ default: FlowPreview }) => {
    createRoot(document.getElementById('root')).render(
      <StrictMode><HashRouter><NotificationProvider><FlowPreview /></NotificationProvider></HashRouter></StrictMode>,
    )
  })
} else {
  document.getElementById('root').textContent = 'La vista previa está disponible solamente en desarrollo.'
}
