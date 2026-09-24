import type { DinoId } from '../../data/dinosaurs';

const KEY = 'dino-roguelite-save-v1';

export interface SaveData {
  runs: number;
  wins: number;
  bestTime: number;
  bestByDino: Partial<Record<DinoId, number>>;
  lastDino?: DinoId;
  /** Endless mode: runs that continued past the story boss. */
  endlessRuns: number;
  /** Highest Era reached (overall and per dinosaur). */
  bestEra: number;
  bestEraByDino: Partial<Record<DinoId, number>>;
}

const EMPTY: SaveData = { runs: 0, wins: 0, bestTime: 0, bestByDino: {}, endlessRuns: 0, bestEra: 0, bestEraByDino: {} };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, bestByDino: {}, bestEraByDino: {} };
    const data = { ...EMPTY, ...JSON.parse(raw) } as SaveData;
    // Saves written before the endless mode lack the per-dino map.
    data.bestEraByDino ??= {};
    return data;
  } catch {
    return { ...EMPTY, bestByDino: {}, bestEraByDino: {} };
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage unavailable (private mode etc.) — progress simply isn't kept
  }
}

/** @param era Era reached in the endless mode (0 if the run never went endless). */
export function recordRun(dino: DinoId, time: number, victory: boolean, era = 0): SaveData {
  const s = loadSave();
  s.runs += 1;
  if (victory) s.wins += 1;
  s.bestTime = Math.max(s.bestTime, time);
  s.bestByDino[dino] = Math.max(s.bestByDino[dino] ?? 0, time);
  s.lastDino = dino;
  if (era > 0) {
    s.endlessRuns += 1;
    s.bestEra = Math.max(s.bestEra, era);
    s.bestEraByDino[dino] = Math.max(s.bestEraByDino[dino] ?? 0, era);
  }
  writeSave(s);
  return s;
}
