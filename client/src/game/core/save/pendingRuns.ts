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
 * Sends the account's queued runs in order (the run id makes a resend harmless). Stops at the
 * first network/5xx failure; drops runs the API rejects (4xx). Returns true if any was accepted.
 */
export async function flushPendingRuns(email: string): Promise<boolean> {
  let sent = false;
  for (const p of pendingRuns().filter((x) => x.email === email)) {
    try {
      await api('/runs', { method: 'POST', body: p.run });
      sent = true;
    } catch (e) {
      if (!(e instanceof ApiError) || e.offline || e.status >= 500 || e.status === 401) return sent;
      console.warn('Run pendente recusada pela API; descartada.', e);
    }
    write(pendingRuns().filter((x) => x.run.id !== p.run.id));
  }
  return sent;
}
