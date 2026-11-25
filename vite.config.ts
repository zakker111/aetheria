import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
            return 'vendor';
          }
          if (id.includes('/src/simulation/') || id.includes('/src/systems/') || id.includes('/src/core/')) {
            return 'engine-sim';
          }
          if (id.includes('/src/presentation/') || id.includes('/src/interaction/')) {
            return 'engine-render';
          }
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: false,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
});
