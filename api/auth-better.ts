/**
 * auth-better.ts — Better Auth catch-all handler
 *
 * Handles all /api/auth-better/* routes:
 *   POST /api/auth-better/sign-up/email
 *   POST /api/auth-better/sign-in/email
 *   GET  /api/auth-better/sign-in/google
 *   GET  /api/auth-better/callback/google
 *   POST /api/auth-better/sign-out
 *   GET  /api/auth-better/get-session
 *
 * This does NOT touch or replace api/auth.ts (old admin SHA-256 login).
 * Both handlers run in parallel during the transition period.
 */
import { auth } from '../lib/betterAuth.js';

// Vercel API handler — Better Auth handles routing internally
export default async function handler(req: any, res: any) {
  // CORS headers (match existing API pattern)
  res.setHeader('Access-Control-Allow-Origin', process.env.BETTER_AUTH_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Cookie'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Convert Vercel's IncomingMessage into a standard Request for Better Auth
  const url = `${process.env.BETTER_AUTH_URL || `https://${req.headers.host}`}${req.url}`;
  
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, val]) => {
    if (val) headers.set(key, Array.isArray(val) ? val[0] : val as string);
  });

  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }
  }

  const request = new Request(url, {
    method: req.method,
    headers,
    body: body ?? null,
  });

  try {
    const response = await auth.handler(request);
    
    // Forward status + headers back to Vercel response
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const responseBody = await response.text();
    res.send(responseBody);
  } catch (error: any) {
    console.error('[auth-better] Handler error:', error);
    res.status(500).json({ error: error?.message || 'Auth handler error' });
  }
}
