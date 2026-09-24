import type { DinoId } from '../../data/dinosaurs';

export interface RunUpgradeRecord {
  id: string;
  name: string;
  rarity: string;
  level: number;
}

/** Everything the result screens need to know about a run. */
export interface RunState {
  dinosaur: DinoId;
  level: number;
  xp: number;
  elapsedTime: number;
  kills: number;
  damageDealt: number;
  damageTaken: number;
  upgrades: RunUpgradeRecord[];
  eliteKilled: boolean;
  bossKilled: boolean;
  victory: boolean;
  primaryTag?: string;
}

export function createRunState(dinosaur: DinoId): RunState {
  return {
    dinosaur,
    level: 1,
    xp: 0,
    elapsedTime: 0,
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
    upgrades: [],
    eliteKilled: false,
    bossKilled: false,
    victory: false,
  };
}
