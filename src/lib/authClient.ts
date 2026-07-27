/**
 * authClient.ts — Better Auth browser client singleton
 *
 * Used by all frontend components for:
 *   - Sign up / sign in (email + Google)
 *   - Session retrieval
 *   - Sign out
 *
 * The old sessionStorage-based JWT flow in useAuth.ts is untouched.
 * This client is only used for new org member sign-ups.
 */
import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  // basePath must match our Vercel serverless handler path (api/auth-better.ts)
  basePath: '/api/auth-better',
  // baseURL defaults to window.location.origin automatically

  plugins: [
    organizationClient(),
  ],
});

// Convenience re-exports for clean imports in components
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
