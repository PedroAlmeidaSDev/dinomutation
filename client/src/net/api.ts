/**
 * HTTP client for the DinoMutation API. Calls are same-origin (`/api/...`): Vite's proxy in
 * development and a Vercel rewrite in production forward them, so the refresh-token cookie
 * stays first-party and no CORS is involved. The access token lives only in memory.
 */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }

  /** The server couldn't be reached at all (network down, API asleep…). */
  get offline(): boolean {
    return this.status === 0;
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  /** Lets the request finish even if the page is closed (used when the boss falls). */
  keepalive?: boolean;
  /** false: no Authorization header and no refresh on 401 (the auth endpoints). */
  auth?: boolean;
}

export type RefreshResult = 'ok' | 'expired' | 'offline';

let fetchImpl: typeof fetch = (input, init) => fetch(input, init);
let accessToken: string | null = null;
let refreshing: Promise<RefreshResult> | null = null;
let sessionLost: () => void = () => {};
// Free-tier hosts can take ~40s to wake up from a cold start; stay below the dialog's patience.
let requestTimeoutMs = 45_000;

/** Test hook: replaces the global fetch. */
export function setFetch(impl: typeof fetch): void {
  fetchImpl = impl;
}

/** Test hook: shortens the request timeout so slow/dead-server tests run fast. */
export function setRequestTimeout(ms: number): void {
  requestTimeoutMs = ms;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Called when the session can't be renewed any more (refresh token expired or revoked). */
export function onSessionLost(fn: () => void): void {
  sessionLost = fn;
}

export async function api<T = unknown>(path: string, o: ApiOptions = {}): Promise<T> {
  const useAuth = o.auth !== false;
  let res = await send(path, o, useAuth);
  if (res.status === 401 && useAuth) {
    const refreshed = await refreshSession();
    if (refreshed === 'ok') res = await send(path, o, useAuth);
    else if (refreshed === 'offline') throw new ApiError(0, 'NETWORK', 'Servidor indisponível.');
    else sessionLost();
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Trades the refresh-token cookie for a new access token; concurrent callers share one request. */
export function refreshSession(): Promise<RefreshResult> {
  refreshing ??= (async (): Promise<RefreshResult> => {
    try {
      const res = await fetchImpl('/api/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (res.status >= 500) return 'offline';
      if (!res.ok) {
        accessToken = null;
        return 'expired';
      }
      accessToken = ((await res.json()) as { accessToken: string }).accessToken;
      return 'ok';
    } catch {
      return 'offline';
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function send(path: string, o: ApiOptions, useAuth: boolean): Promise<Response> {
  const headers: Record<string, string> = {};
  if (o.body !== undefined) headers['Content-Type'] = 'application/json';
  if (useAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetchImpl(`/api${path}`, {
      method: o.method ?? 'GET',
      headers,
      credentials: 'same-origin',
      keepalive: o.keepalive,
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Servidor indisponível.');
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: { code?: string; detail?: string; title?: string } = {};
  try {
    body = await res.json();
  } catch {
    // not JSON (e.g. the bare 401 of the resource server)
  }
  return new ApiError(res.status, body.code ?? `HTTP_${res.status}`, body.detail ?? body.title ?? `Erro ${res.status}`);
}
