import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'stats.html',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
      open: false,
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/xlsx')) return 'xlsx'
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2')) return 'charts'
          if (id.includes('node_modules/firebase')) return 'firebase'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) return 'vendor'
        },
      },
    },
  },
})
