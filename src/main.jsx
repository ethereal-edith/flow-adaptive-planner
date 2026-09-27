import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { migrateDataIfNeeded } from './data/storage.js'

// Wipe stale seed data from previous schema versions before anything renders
migrateDataIfNeeded();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

