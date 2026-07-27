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
 * IMPORTANT — how Vercel routing works here:
 *   vercel.json rewrite: /api/auth-better/:path* → /api/auth-better
 *   Vercel captures the sub-path and appends it as ?path=sign-in/email
 *   We must reconstruct /api/auth-better/sign-in/email before passing to auth.handler()
 */
import { auth } from '../lib/betterAuth.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', process.env.BETTER_AUTH_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const baseHost =
    process.env.BETTER_AUTH_URL || `https://${req.headers.host}`;

  // Vercel's rewrite captures :path* and appends it as ?path=sign-in/email
  // We reconstruct the original path so Better Auth can route correctly.
  const capturedPath = req.query?.path;
  let authPath: string;
  if (capturedPath) {
    const sub = Array.isArray(capturedPath) ? capturedPath.join('/') : capturedPath;
    authPath = `/api/auth-better/${sub}`;
  } else {
    // Direct hit to /api/auth-better with no sub-path (e.g. session polling)
    authPath = '/api/auth-better';
  }

  const url = `${baseHost}${authPath}`;

  const headers = new Headers();
  Object.entries(req.headers as Record<string, string | string[]>).forEach(([key, val]) => {
    if (val) headers.set(key, Array.isArray(val) ? val[0] : (val as string));
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
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    res.send(await response.text());
  } catch (error: any) {
    console.error('[auth-better] Handler error:', error);
    res.status(500).json({ error: error?.message || 'Auth handler error' });
  }
}
