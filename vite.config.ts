import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Handle WASM files for OpenSCAD
  optimizeDeps: {
    exclude: ['openscad-wasm'],
  },
  
  // Allow SharedArrayBuffer for WASM threading
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  
  build: {
    target: 'esnext',
  },
  
  // Worker configuration
  worker: {
    format: 'es',
  },
  
  // Ensure WASM files are served correctly
  assetsInclude: ['**/*.wasm'],
})
