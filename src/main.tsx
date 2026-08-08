import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Hide crawl-only bootstrap once React mounts (keeps initial HTML for bots)
document.getElementById('seo-bootstrap')?.remove()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
