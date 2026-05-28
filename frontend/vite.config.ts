import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  cacheDir: '.vite-cache',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true, // listen on 0.0.0.0 so other machines on the LAN can reach it
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5050', // backend port — keep in sync with backend/.env PORT
        changeOrigin: true,
      },
    },
  },
})
