import * as crypto from 'crypto';
import type { Handler } from '@netlify/functions';
import { signJwt } from './utils/jwt';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const hashPassword = (value: string) =>
  crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  return crypto.timingSafeEqual(aBuf, bBuf);
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const password: string | undefined = body.password;
    const userType: string | undefined = body.userType || 'admin';

    // For trial mode, allow login without password check, but issue JWT
    if (userType === 'trial') {
      const token = signJwt({ userType: 'trial' });
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ ok: true, token, userType: 'trial' }),
      };
    }

    // For admin mode, require password
    if (!password) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Password is required' }),
      };
    }

    const expectedHash = process.env.ADMIN_PASSWORD_HASH || '';
    if (!expectedHash) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Server password is not configured' }),
      };
    }

    const incomingHash = hashPassword(password);
    const isValid = timingSafeEqual(expectedHash, incomingHash);

    if (!isValid) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Invalid password' }),
      };
    }

    const token = signJwt({ userType: 'admin' });
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, token, userType: 'admin' }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Unexpected error' }),
    };
  }
};
