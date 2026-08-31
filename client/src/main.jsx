import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Mobile browsers (especially Android Chrome) resize their visible viewport
// as the address bar shows/hides on scroll, and CSS `dvh` doesn't always
// track that reliably on every device. This measures the *actual* visible
// height with JS and keeps it in sync, which is the more robust fix — the
// CSS still has vh/dvh fallbacks for the instant before this first runs.
function setAppHeight() {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
}
setAppHeight()
window.addEventListener('resize', setAppHeight)
window.addEventListener('orientationchange', setAppHeight)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)