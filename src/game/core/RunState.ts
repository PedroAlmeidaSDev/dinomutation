import type { DifficultyId } from '../../data/difficulty';
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
  difficulty: DifficultyId;
  level: number;
  xp: number;
  elapsedTime: number;
  kills: number;
  damageDealt: number;
  damageTaken: number;
  /** Damage dealt per source key (data/damageSources.ts), for the result screen. */
  damageBySource: Record<string, number>;
  upgrades: RunUpgradeRecord[];
  eliteKilled: boolean;
  bossKilled: boolean;
  victory: boolean;
  primaryTag?: string;
  /** Continued into the endless mode after beating the Giganotosaurus. */
  endless: boolean;
  /** Current Era (0 = story). */
  era: number;
  /** Seconds survived in the endless mode. */
  endlessTime: number;
  /** Names of the active Era mutations. */
  mutations: string[];
}

export function createRunState(dinosaur: DinoId, difficulty: DifficultyId = 'normal'): RunState {
  return {
    dinosaur,
    difficulty,
    level: 1,
    xp: 0,
    elapsedTime: 0,
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
    damageBySource: {},
    upgrades: [],
    eliteKilled: false,
    bossKilled: false,
    victory: false,
    endless: false,
    era: 0,
    endlessTime: 0,
    mutations: [],
  };
}
