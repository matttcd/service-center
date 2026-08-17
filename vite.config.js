import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Destino de /api en desarrollo. Por defecto el backend de desarrollo (:3001)
// para NO tocar producción. Si alguna vez querés apuntar a otro lado:
//   VITE_API_TARGET=http://localhost:8080 npm run dev
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // html2canvas 1.4.1 no entiende los colores oklch() de Tailwind v4 (PDF se colgaba).
  // jspdf hace import("html2canvas") dinámico; lo redirigimos al fork html2canvas-pro.
  resolve: {
    alias: {
      html2canvas: 'html2canvas-pro',
    },
  },
  // Permite acceder desde otros dispositivos de la red (LAN).
  server: {
    host: true,
    // En modo desarrollo, redirige las llamadas /api al backend de desarrollo.
    proxy: {
      '/api': apiTarget,
    },
  },
  preview: {
    host: true,
    proxy: {
      '/api': apiTarget,
    },
  },
})
