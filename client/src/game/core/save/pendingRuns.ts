import { ApiError, api } from '../../../net/api';
import type { RunRequest } from './apiTypes';

const KEY = 'dino-pending-runs';

/** A run the API didn't receive, tagged with the account that played it. */
export interface PendingRun {
  email: string;
  run: RunRequest;
}

export function pendingRuns(): PendingRun[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as PendingRun[];
  } catch {
    return [];
  }
}

function write(list: PendingRun[]): void {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable — nothing to keep
  }
}

export function enqueuePendingRun(email: string, run: RunRequest): void {
  write([...pendingRuns().filter((p) => p.run.id !== run.id), { email, run }]);
}

/**
 * A failure worth keeping the run for: network down, a server error, the session lost (the
 * queue is per account and is sent at the next sign-in) or a CONFLICT (concurrent update on
 * the server). Any other 4xx means the API refused this run for good.
 */
export function isQueueable(e: unknown): boolean {
  return e instanceof ApiError && (e.offline || e.status >= 500 || e.status === 401 || e.code === 'CONFLICT');
}

/**
 * Sends the account's queued runs in order (the run id makes a resend harmless). Stops at the
 * first queueable failure (see isQueueable); drops runs the API rejects for good. Returns true
 * if any was accepted.
 */
export async function flushPendingRuns(email: string): Promise<boolean> {
  let sent = false;
  for (const p of pendingRuns().filter((x) => x.email === email)) {
    try {
      await api('/runs', { method: 'POST', body: p.run });
      sent = true;
    } catch (e) {
      if (!(e instanceof ApiError) || isQueueable(e)) return sent;
      console.warn('Run pendente recusada pela API; descartada.', e);
    }
    write(pendingRuns().filter((x) => x.run.id !== p.run.id));
  }
  return sent;
}
