/**
 * useSaFetch.ts — Clerk-authenticated fetch hook for the Super Admin SPA
 *
 * Gets a fresh Clerk JWT on every call and attaches it as Bearer token.
 * All SA panel API calls use /api/* (native Vercel serverless functions).
 */
import { useAuth } from '@clerk/react';
import { useCallback } from 'react';

export function useSaFetch() {
  const { getToken } = useAuth();

  return useCallback(
    async (path: string, options: RequestInit = {}): Promise<Response> => {
      const token = await getToken();
      return fetch(`/api${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // allow caller to override headers
          ...options.headers,
        },
      });
    },
    [getToken]
  );
}
