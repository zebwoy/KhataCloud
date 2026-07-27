/**
 * betterAuth.ts — Server-side Better Auth instance for HisaabKitaab
 *
 * Used by API handlers to:
 *   - Verify session tokens from cookies (org member logins)
 *   - Handle sign-up, sign-in, OAuth callbacks
 *
 * This does NOT replace the existing JWT auth — it runs in parallel.
 * Old admin logins via ADMIN_PASSWORD_HASH continue to work unchanged.
 */
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { organization } from 'better-auth/plugins';

// Use direct (non-pooled) connection for auth library's own schema management
// Better Auth manages its own tables in the neon_auth schema
const authPool = new Pool({
  connectionString:
    process.env.NEON_CONNECTION_STRING ||
    process.env.NETLIFY_DB_URL ||
    '',
  max: 3, // Keep small — auth operations are infrequent
});

export const auth = betterAuth({
  // Base URL of the deployed app (required for OAuth redirects)
  baseURL: process.env.BETTER_AUTH_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:5173',

  secret: process.env.BETTER_AUTH_SECRET || 'dev-secret-change-in-production-32chars',

  database: {
    type: 'pg',
    pool: authPool,
  },

  // Email + password sign-in
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Keep false until you set up SMTP
  },

  // Google SSO
  socialProviders: {
    google: {
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
  },

  // Organization plugin — lets users belong to multiple orgs
  // Used to track org membership after approval
  plugins: [
    organization(),
  ],

  // Session config
  session: {
    expiresIn: 60 * 60 * 24 * 7,       // 7 days
    updateAge: 60 * 60 * 24,            // Refresh if older than 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,                   // Cache cookie for 5 minutes
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
