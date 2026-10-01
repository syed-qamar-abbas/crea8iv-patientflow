import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Portal is served from crea8ivmedia.com/clinic/ — assets must resolve there.
  // Custom-domain (root) builds override this with `vite build --base=/`.
  base: '/clinic/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts')) return 'vendor-charts';
          if (id.includes('react-big-calendar') || id.includes('moment')) return 'vendor-calendar';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (
            id.includes('react-router-dom')
            || id.includes('@remix-run/router')
            || id.includes('react-dom')
            || id.includes('scheduler')
            || /node_modules\/react\//.test(id)
          ) {
            return 'vendor-react';
          }
          return undefined;
        },
      },
    },
  },
})
