import type { DifficultyId } from '../../data/difficulty';
import type { DinoId } from '../../data/dinosaurs';
import { uuid } from '../../utils/uuid';

export interface RunUpgradeRecord {
  id: string;
  name: string;
  rarity: string;
  level: number;
}

/** First win on a difficulty with a dinosaur (see Save.recordClear). */
export interface FirstClear {
  firstWinBonus: number;
  /** Name of the difficulty unlocked by the win, if any. */
  unlockedDifficulty?: string;
}

/** Everything the result screens need to know about a run. */
export interface RunState {
  /** Generated when the run starts; the API uses it to ignore a resent run (POST /api/runs). */
  id: string;
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
  /** Set (and already saved) when the story boss falls on a difficulty not beaten before. */
  firstClear?: FirstClear;
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
    id: uuid(),
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
