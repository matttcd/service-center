import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Destino de /api en desarrollo. Por defecto el backend de desarrollo (:3001)
// para NO tocar producción. Si alguna vez querés apuntar a otro lado:
//   VITE_API_TARGET=http://localhost:8080 npm run dev
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:4000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
