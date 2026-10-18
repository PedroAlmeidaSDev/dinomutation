import type { DifficultyId } from '../../../data/difficulty';
import type { DinoId } from '../../../data/dinosaurs';
import type { RunUpgradeRecord } from '../RunState';
import type { SaveData } from '../Save';

/** Shapes of the API (server/src/main/java/com/dinomutation/...). */
export interface Account {
  email: string;
  displayName: string;
}

/** GET /api/players/me/save: SaveData (maps may be missing) plus the account. */
export type SaveDto = Partial<SaveData> & Account;

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface RunRequest {
  id: string;
  dino: DinoId;
  difficulty: DifficultyId;
  victory: boolean;
  elapsedTime: number;
  kills: number;
  level: number;
  eliteKilled: boolean;
  bossKilled: boolean;
  endless: boolean;
  era: number;
  endlessTime: number;
  damageDealt: number;
  damageTaken: number;
  upgrades: RunUpgradeRecord[];
}

export interface RunRewardsDto {
  fossils: number;
  firstWinBonus: number;
  /** Difficulty id ("normal"), not its display name. */
  unlockedDifficulty?: DifficultyId;
  masteryXp: number;
  levelBefore: number;
  levelAfter: number;
}

export interface RunResponse {
  rewards: RunRewardsDto;
  save: SaveDto;
}

export interface ClearResponse {
  firstWinBonus: number;
  unlockedDifficulty?: DifficultyId;
}

export interface PurchaseResponse {
  save: SaveDto;
}
