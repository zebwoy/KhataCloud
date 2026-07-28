/**
 * useSaFetch.ts — Clerk-authenticated fetch hook for the Super Admin SPA
 *
 * Replaces the old module-level `saFetch` in every SA component.
 * Gets a fresh Clerk JWT on every call and attaches it as Bearer token.
 */
import { useAuth } from '@clerk/react';
import { useCallback } from 'react';

export function useSaFetch() {
  const { getToken } = useAuth();

  return useCallback(
    async (path: string, options: RequestInit = {}): Promise<Response> => {
      const token = await getToken();
      return fetch(`/.netlify/functions${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // caller can override headers if needed
          ...options.headers,
        },
      });
    },
    [getToken]
  );
}
