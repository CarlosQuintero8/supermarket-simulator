import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { useGame } from './game/store'
import './index.css'

if (import.meta.env.DEV) {
  // Acceso al estado desde la consola para depurar (solo en desarrollo).
  ;(window as unknown as { __game: typeof useGame }).__game = useGame
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
