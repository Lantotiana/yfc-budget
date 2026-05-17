import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/xlsx')) return 'xlsx'
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) return 'charts'
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            if (id.includes('/auth') || id.includes('\\auth')) return 'firebase-auth'
            if (id.includes('/firestore') || id.includes('\\firestore')) return 'firebase-firestore'
            if (id.includes('/storage') || id.includes('\\storage')) return 'firebase-storage'
            if (id.includes('/functions') || id.includes('\\functions')) return 'firebase-functions'
            if (id.includes('/messaging') || id.includes('\\messaging')) return 'firebase-messaging'
            return 'firebase-core'
          }
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'vendor'
        },
      },
    },
  },
})
