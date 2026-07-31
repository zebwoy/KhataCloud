/**
 * lib/vercel-handler.ts — Minimal Vercel serverless function types
 *
 * Replaces the @vercel/node package dependency.
 * Satisfies the actual Vercel runtime interface without adding a new package.
 */

export interface VercelReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[]>;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface VercelRes {
  setHeader(name: string, value: string | string[]): this;
  status(code: number): this;
  json(data: unknown): void;
  send(data: unknown): void;
  end(): void;
}

/** Helper — safely extract a single string from query params */
export function qp(
  query: Record<string, string | string[]>,
  key: string
): string | undefined {
  const v = query[key];
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/** Set standard CORS headers on every response */
export function setCors(
  res: VercelRes,
  methods = 'GET, POST, PUT, DELETE, OPTIONS'
): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', methods);
}
