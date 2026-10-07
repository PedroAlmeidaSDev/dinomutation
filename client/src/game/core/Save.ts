import { DIFFICULTIES, DIFFICULTY_BY_ID, difficultyIndex, highestUnlocked, type DifficultyId } from '../../data/difficulty';
import { DINO_ORDER, type DinoId } from '../../data/dinosaurs';
import {
  fossilsForRun, loadoutFor, masteryLevel, masteryXpForRun, unlocksAtMastery, type MetaBonus, type ShopItemDef,
} from '../../data/meta';
import type { FirstClear, RunState } from './RunState';

const KEY = 'dino-roguelite-save-v1';

export interface SaveData {
  runs: number;
  wins: number;
  bestTime: number;
  bestByDino: Partial<Record<DinoId, number>>;
  lastDino?: DinoId;
  /** Global currency. */
  fossils: number;
  /** Total mastery XP per dinosaur. */
  mastery: Partial<Record<DinoId, number>>;
  /** Purchased level of each shop item, per dinosaur. */
  shop: Partial<Record<DinoId, Record<string, number>>>;
  /** Endless mode: runs that continued past the story boss. */
  endlessRuns: number;
  /** Highest Era reached (overall and per dinosaur). */
  bestEra: number;
  bestEraByDino: Partial<Record<DinoId, number>>;
  /** Last patch-notes version the player has seen (see data/patchNotes.ts). */
  seenPatch?: string;
  /** Index in DIFFICULTIES of the highest difficulty beaten, per dinosaur (missing = none). */
  cleared: Partial<Record<DinoId, number>>;
  /** Last difficulty picked, per dinosaur. */
  difficulty: Partial<Record<DinoId, DifficultyId>>;
}

function empty(): SaveData {
  return {
    runs: 0, wins: 0, bestTime: 0, bestByDino: {}, fossils: 0, mastery: {}, shop: {},
    endlessRuns: 0, bestEra: 0, bestEraByDino: {}, cleared: {}, difficulty: {},
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    // Older saves (before meta-progression / endless mode) simply lack the new fields.
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const save = { ...empty(), ...parsed } as SaveData;
    // Before difficulties: players who already won skip Filhote (Normal unlocked for every dino).
    if (!parsed.cleared && save.wins > 0) for (const d of DINO_ORDER) save.cleared[d] = 0;
    return save;
  } catch {
    return empty();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage unavailable (private mode etc.) — progress simply isn't kept
  }
}

/** Marks the patch notes of `version` as seen so they aren't shown again. */
export function markPatchSeen(version: string): void {
  const s = loadSave();
  s.seenPatch = version;
  writeSave(s);
}

export interface RunRewards {
  /** Total Fósseis, including `firstWinBonus`. */
  fossils: number;
  /** First win on this difficulty with this dinosaur (0 = not a first win). */
  firstWinBonus: number;
  /** Difficulty unlocked by this win, if any. */
  unlockedDifficulty?: string;
  masteryXp: number;
  levelBefore: number;
  levelAfter: number;
  /** Human-readable unlocks from mastery levels gained this run. */
  unlocks: string[];
}

export function recordRun(state: RunState, victory: boolean): { save: SaveData; rewards: RunRewards } {
  const s = loadSave();
  const dino = state.dinosaur;
  s.runs += 1;
  if (victory) s.wins += 1;
  s.bestTime = Math.max(s.bestTime, state.elapsedTime);
  s.bestByDino[dino] = Math.max(s.bestByDino[dino] ?? 0, state.elapsedTime);
  s.lastDino = dino;
  const era = state.endless ? state.era : 0;
  if (era > 0) {
    s.endlessRuns += 1;
    s.bestEra = Math.max(s.bestEra, era);
    s.bestEraByDino[dino] = Math.max(s.bestEraByDino[dino] ?? 0, era);
  }

  const runFossils = fossilsForRun({ ...state, fossilMult: DIFFICULTY_BY_ID[state.difficulty].fossilMult });
  // The clear is normally saved when the boss fell (recordClear); this covers callers that didn't.
  const clear = state.firstClear ?? (victory ? applyClear(s, dino, state.difficulty) : undefined);
  const firstWinBonus = clear?.firstWinBonus ?? 0;
  const fossils = runFossils + firstWinBonus;
  const masteryXp = masteryXpForRun(state);
  const xpBefore = s.mastery[dino] ?? 0;
  const levelBefore = masteryLevel(xpBefore);
  s.fossils += runFossils;
  s.mastery[dino] = xpBefore + masteryXp;
  const levelAfter = masteryLevel(s.mastery[dino]!);
  const unlocks: string[] = [];
  for (let l = levelBefore + 1; l <= levelAfter; l++) unlocks.push(...unlocksAtMastery(dino, l));

  writeSave(s);
  return { save: s, rewards: { fossils, firstWinBonus, unlockedDifficulty: clear?.unlockedDifficulty, masteryXp, levelBefore, levelAfter, unlocks } };
}

// ─────────────────────────── difficulty ───────────────────────────

/**
 * Saves a story win right when the boss falls: unlocks the next difficulty and pays the
 * first-win bonus. Quitting mid-endless (or closing the tab) skips the result screen, so
 * this can't wait for recordRun. Returns undefined if the difficulty was already beaten.
 */
export function recordClear(dino: DinoId, difficulty: DifficultyId): FirstClear | undefined {
  const s = loadSave();
  const clear = applyClear(s, dino, difficulty);
  if (clear) writeSave(s);
  return clear;
}

function applyClear(s: SaveData, dino: DinoId, difficulty: DifficultyId): FirstClear | undefined {
  const idx = difficultyIndex(difficulty);
  if (idx <= clearedIndex(s, dino)) return undefined;
  s.cleared[dino] = idx;
  const firstWinBonus = DIFFICULTY_BY_ID[difficulty].firstWinBonus;
  s.fossils += firstWinBonus;
  return { firstWinBonus, unlockedDifficulty: DIFFICULTIES[idx + 1]?.name };
}

/** Index of the highest difficulty beaten with `dino` (-1 = none). */
export function clearedIndex(s: SaveData, dino: DinoId): number {
  return s.cleared[dino] ?? -1;
}

export function isDifficultyUnlocked(s: SaveData, dino: DinoId, id: DifficultyId): boolean {
  return difficultyIndex(id) <= highestUnlocked(clearedIndex(s, dino));
}

/** Last difficulty picked for `dino`, or the highest unlocked one. */
export function preferredDifficulty(s: SaveData, dino: DinoId): DifficultyId {
  const last = s.difficulty[dino];
  if (last && isDifficultyUnlocked(s, dino, last)) return last;
  return DIFFICULTIES[highestUnlocked(clearedIndex(s, dino))].id;
}

export function rememberDifficulty(dino: DinoId, id: DifficultyId): void {
  const s = loadSave();
  s.difficulty[dino] = id;
  writeSave(s);
}

// ─────────────────────────── shop ───────────────────────────

export function shopLevel(s: SaveData, dino: DinoId, itemId: string): number {
  return s.shop[dino]?.[itemId] ?? 0;
}

export type PurchaseStatus = 'ok' | 'maxed' | 'poor';

export function purchaseStatus(s: SaveData, dino: DinoId, item: ShopItemDef): PurchaseStatus {
  const lvl = shopLevel(s, dino, item.id);
  if (lvl >= item.costs.length) return 'maxed';
  if (s.fossils < item.costs[lvl]) return 'poor';
  return 'ok';
}

/** Buys the next level of an item. Returns the updated save, or null if not allowed. */
export function purchase(dino: DinoId, item: ShopItemDef): SaveData | null {
  const s = loadSave();
  if (purchaseStatus(s, dino, item) !== 'ok') return null;
  const lvl = shopLevel(s, dino, item.id);
  s.fossils -= item.costs[lvl];
  s.shop[dino] = { ...s.shop[dino], [item.id]: lvl + 1 };
  writeSave(s);
  return s;
}

export function metaLoadout(dino: DinoId, s: SaveData = loadSave()): MetaBonus[] {
  return loadoutFor(dino, s.shop[dino] ?? {}, s.mastery[dino] ?? 0);
}

/** Debug helper (?debug): grants fossils and mastery to every dinosaur. */
export function debugGrant(fossils: number, masteryXp: number): SaveData {
  const s = loadSave();
  s.fossils += fossils;
  for (const d of DINO_ORDER) s.mastery[d] = (s.mastery[d] ?? 0) + masteryXp;
  writeSave(s);
  return s;
}
