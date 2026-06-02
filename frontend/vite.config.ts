import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev server runs on plain HTTP by default so phones on the LAN can reach
// it without dealing with self-signed certificate warnings (some Android
// browsers and security settings hide the "Proceed anyway" option, which
// blocks the page entirely).
//
// Live camera streaming via getUserMedia requires a secure context (HTTPS
// or localhost), so the QR scanner uses a "scan from a photo" fallback on
// non-secure origins. To enable HTTPS for live-camera testing on a phone,
// install @vitejs/plugin-basic-ssl and import it conditionally — or use
// mkcert for a properly trusted LAN cert.
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
      // Static media uploaded by CSR (Events & News) is served by the
      // backend at /uploads/<file>. Without this proxy the dev server
      // would 404 those URLs and the post media would render as broken.
      '/uploads': {
        target: 'http://127.0.0.1:5050',
        changeOrigin: true,
      },
    },
  },
})
