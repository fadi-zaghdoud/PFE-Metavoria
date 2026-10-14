import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/inter/index.css'
import './index.css'
// Thème : écoute du réglage du système et des autres onglets, dès le démarrage (le thème
// initial est déjà posé par le script d'index.html).
import './lib/theme'
import App from './App.tsx'
import { ToastProvider } from './components/ui/Toast.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
