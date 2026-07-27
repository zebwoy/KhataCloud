import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App.tsx'
import SuperAdminApp from './SuperAdminApp.tsx'
import './index.css'

// Route-based root: /superadmin → SuperAdminApp, everything else → App
const isSuperAdminRoute = window.location.pathname.startsWith('/superadmin')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isSuperAdminRoute ? <SuperAdminApp /> : <App />}
    {/* Vercel Web Analytics — free 50K events/month, no cookies, GDPR-friendly */}
    <Analytics />
  </React.StrictMode>,
)


