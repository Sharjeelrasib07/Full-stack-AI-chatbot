import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Mobile browsers (especially Android Chrome) resize their visible viewport
// as the address bar shows/hides on scroll, and CSS `dvh` doesn't always
// track that reliably on every device. This measures the *actual* visible
// height with JS and keeps it in sync, which is the more robust fix — the
// CSS still has vh/dvh fallbacks for the instant before this first runs.
//
// window.visualViewport tracks the address bar / on-screen keyboard more
// reliably than window.innerHeight + the plain 'resize' event on some
// Android Chrome versions, so prefer it when available.
function currentHeight() {
  return window.visualViewport ? window.visualViewport.height : window.innerHeight
}
function setAppHeight() {
  document.documentElement.style.setProperty('--app-height', `${currentHeight()}px`)
}
setAppHeight()
window.addEventListener('resize', setAppHeight)
window.addEventListener('orientationchange', setAppHeight)
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', setAppHeight)
}
// Re-measure a beat after load too: on some Android Chrome versions the
// address bar finishes its show/hide animation slightly after the resize
// event fires, so the first measurement can be briefly stale.
setTimeout(setAppHeight, 300)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
