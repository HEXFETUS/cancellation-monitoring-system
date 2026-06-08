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
  build: {
    // Bump the warning threshold slightly so that a single, well-justified
    // ~700 kB vendor chunk (mostly react + react-dom + react-router-dom)
    // doesn't trip the alarm. Anything noticeably bigger will still warn
    // and surface the real offenders (e.g. html5-qrcode, qrcode.react).
    chunkSizeWarningLimit: 800,
    // Split long-lived vendor code into its own chunks so it can be cached
    // independently of the app code. The page/route code is already
    // lazy-loaded via React.lazy in the router.
    rolldownOptions: {
      output: {
        manualChunks: (id) => {
          // Anything in node_modules goes into a vendor chunk.
          if (id.includes('node_modules')) {
            // Keep large specialty libraries in their own chunks so the
            // main vendor file stays small and they can be lazy-loaded.
            if (id.includes('html5-qrcode')) return 'vendor-qr-scanner';
            if (id.includes('qrcode.react') || id.includes('qr.js')) return 'vendor-qrcode';
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            return 'vendor';
          }
        },
      },
    },
  },
})
