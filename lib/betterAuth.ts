import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { organization } from 'better-auth/plugins';

const authPool = new Pool({
  connectionString: process.env.NEON_CONNECTION_STRING || process.env.NETLIFY_DB_URL || '',
  max: 3,
});

export const auth = betterAuth({
  // Correct operator precedence: parens around the ternary
  baseURL: process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173'),

  // Must match the API route file name so Better Auth can recognise
  // incoming requests at /api/auth-better/* (default would be /api/auth)
  basePath: '/api/auth-better',

  secret: process.env.BETTER_AUTH_SECRET || 'dev-secret-change-in-production-32chars',

  database: {
    type: 'pg',
    pool: authPool,
  },

  emailAndPassword: { enabled: true, requireEmailVerification: false },

  socialProviders: {
    google: {
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
  },

  plugins: [organization()],

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
