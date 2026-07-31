import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import { Analytics } from '@vercel/analytics/react'
import RootApp from './RootApp.tsx'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!PUBLISHABLE_KEY) {
  console.error('[KhataCloud] VITE_CLERK_PUBLISHABLE_KEY is not set. Auth will not work.');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      /**
       * signInUrl               — tells Clerk where your login page lives
       *                           (used for redirects from Clerk-hosted flows)
       * signInFallbackRedirectUrl — where to go after sign-in if nothing else specified
       * signInForceRedirectUrl   — always redirect here after any sign-in
       */
      signInUrl="/auth"
      signInFallbackRedirectUrl="/admin"
      signInForceRedirectUrl="/admin"
    >
      <RootApp />
      <Analytics />
    </ClerkProvider>
  </React.StrictMode>,
)
