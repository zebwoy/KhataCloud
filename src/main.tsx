import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { Analytics } from '@vercel/analytics/react'
import App from './App.tsx'
import SuperAdminApp from './SuperAdminApp.tsx'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

// Route-based root: /superadmin → SuperAdminApp, everything else → App
const isSuperAdminRoute = window.location.pathname.startsWith('/superadmin')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      {isSuperAdminRoute ? <SuperAdminApp /> : <App />}
      {/* Vercel Web Analytics — free 50K events/month, no cookies, GDPR-friendly */}
      <Analytics />
    </ClerkProvider>
  </React.StrictMode>,
)


