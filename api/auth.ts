/**
 * api/auth.ts — Authentication endpoint
 *
 * POST /api/auth
 *   { userType: 'trial' }           → issues trial JWT (no password required)
 *   { userType: 'admin', password } → verifies SHA-256 hash, issues admin JWT
 *
 * The SHA-256 admin path is kept for backward compatibility during migration.
 * Trial mode continues to use this endpoint — org users authenticate via Clerk.
 */
import * as crypto from 'crypto';
import { signJwt } from '../lib/jwt.js';
import type { VercelReq, VercelRes } from '../lib/vercel-handler.js';
import { setCors } from '../lib/vercel-handler.js';

const hashPassword = (value: string) =>
  crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const timingSafeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
};

export default async function handler(req: VercelReq, res: VercelRes) {
  setCors(res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const body = req.body ?? {};
    const password: string | undefined = body.password;
    const userType: string = body.userType ?? 'admin';

    // ── Trial mode: no password, scoped JWT ─────────────────────────────────
    if (userType === 'trial') {
      const token = signJwt({ userType: 'trial' });
      return res.status(200).json({ ok: true, token, userType: 'trial' });
    }

    // ── Admin mode: SHA-256 password check ──────────────────────────────────
    if (!password?.trim()) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const expectedHash = process.env.ADMIN_PASSWORD_HASH ?? '';
    if (!expectedHash) {
      return res.status(500).json({ message: 'Server password not configured' });
    }

    if (!timingSafeCompare(expectedHash, hashPassword(password))) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const token = signJwt({ userType: 'admin' });
    return res.status(200).json({ ok: true, token, userType: 'admin' });
  } catch {
    return res.status(500).json({ message: 'Unexpected server error' });
  }
}
