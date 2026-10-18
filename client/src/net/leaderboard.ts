import type { DifficultyId } from '../data/difficulty';
import type { DinoId } from '../data/dinosaurs';
import { ApiError, api } from './api';

/** One line of GET /api/leaderboard (a player's best run within the filter). */
export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  elapsedTime: number;
  dino: DinoId;
  difficulty: DifficultyId;
  era: number;
  achievedAt: string;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  /** The signed-in player's own line, even outside the list. */
  me?: LeaderboardEntry;
}

export interface LeaderboardFilter {
  dino?: DinoId;
  difficulty?: DifficultyId;
}

/** Public endpoint: guests call it without a token; with a session the API adds `me`. */
export async function fetchLeaderboard(filter: LeaderboardFilter = {}, limit = 20): Promise<Leaderboard> {
  const query = new URLSearchParams();
  if (filter.dino) query.set('dino', filter.dino);
  if (filter.difficulty) query.set('difficulty', filter.difficulty);
  query.set('limit', String(limit));
  const path = `/leaderboard?${query}`;
  try {
    return await api<Leaderboard>(path);
  } catch (err) {
    // The ranking is public: a dead/invalid session (token rejected, refresh also failed) must
    // not hide it. Retry once as a guest — same data, just without the signed-in player's `me`.
    if (err instanceof ApiError && err.status === 401) return api<Leaderboard>(path, { auth: false });
    throw err;
  }
}
