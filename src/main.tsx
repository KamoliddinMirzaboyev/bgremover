import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerModelCacheSw } from './lib/registerSw'
import { warmModelManifest } from './lib/warmCache'

function boot(): void {
  // Only run in a real browser document (not workers / node)
  if (typeof document === 'undefined') return

  document.getElementById('seo-bootstrap')?.remove()

  const root = document.getElementById('root')
  if (!root) return

  registerModelCacheSw()
  void warmModelManifest()

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

boot()
