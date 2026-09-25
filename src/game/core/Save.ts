import { DINO_ORDER, type DinoId } from '../../data/dinosaurs';
import {
  fossilsForRun, loadoutFor, masteryLevel, masteryXpForRun, unlocksAtMastery, type MetaBonus, type ShopItemDef,
} from '../../data/meta';
import type { RunState } from './RunState';

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
}

function empty(): SaveData {
  return {
    runs: 0, wins: 0, bestTime: 0, bestByDino: {}, fossils: 0, mastery: {}, shop: {},
    endlessRuns: 0, bestEra: 0, bestEraByDino: {},
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    // Older saves (before meta-progression / endless mode) simply lack the new fields.
    return { ...empty(), ...JSON.parse(raw) } as SaveData;
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
  fossils: number;
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

  const fossils = fossilsForRun(state);
  const masteryXp = masteryXpForRun(state);
  const xpBefore = s.mastery[dino] ?? 0;
  const levelBefore = masteryLevel(xpBefore);
  s.fossils += fossils;
  s.mastery[dino] = xpBefore + masteryXp;
  const levelAfter = masteryLevel(s.mastery[dino]!);
  const unlocks: string[] = [];
  for (let l = levelBefore + 1; l <= levelAfter; l++) unlocks.push(...unlocksAtMastery(dino, l));

  writeSave(s);
  return { save: s, rewards: { fossils, masteryXp, levelBefore, levelAfter, unlocks } };
}

// ─────────────────────────── shop ───────────────────────────

export function shopLevel(s: SaveData, dino: DinoId, itemId: string): number {
  return s.shop[dino]?.[itemId] ?? 0;
}

export type PurchaseStatus = 'ok' | 'maxed' | 'locked' | 'poor';

export function purchaseStatus(s: SaveData, dino: DinoId, item: ShopItemDef): PurchaseStatus {
  const lvl = shopLevel(s, dino, item.id);
  if (lvl >= item.costs.length) return 'maxed';
  if (masteryLevel(s.mastery[dino] ?? 0) < item.mastery[lvl]) return 'locked';
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
