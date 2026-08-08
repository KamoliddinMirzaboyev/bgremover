import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@imgly/background-removal'],
  },
  worker: {
    format: 'es',
  },
  build: {
    // Vite injects a modulepreload polyfill that uses bare `document` at the
    // top of the entry chunk. That throws ReferenceError if the chunk is ever
    // evaluated without a DOM (workers / some embedders). Modern browsers
    // support <link rel="modulepreload"> natively — polyfill not needed.
    modulePreload: {
      polyfill: false,
    },
  },
})
