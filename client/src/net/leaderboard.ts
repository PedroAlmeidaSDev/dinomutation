import type { DifficultyId } from '../data/difficulty';
import type { DinoId } from '../data/dinosaurs';
import { api } from './api';

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
export function fetchLeaderboard(filter: LeaderboardFilter = {}, limit = 20): Promise<Leaderboard> {
  const query = new URLSearchParams();
  if (filter.dino) query.set('dino', filter.dino);
  if (filter.difficulty) query.set('difficulty', filter.difficulty);
  query.set('limit', String(limit));
  return api<Leaderboard>(`/leaderboard?${query}`);
}
