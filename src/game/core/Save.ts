import type { DinoId } from '../../data/dinosaurs';

const KEY = 'dino-roguelite-save-v1';

export interface SaveData {
  runs: number;
  wins: number;
  bestTime: number;
  bestByDino: Partial<Record<DinoId, number>>;
  lastDino?: DinoId;
}

const EMPTY: SaveData = { runs: 0, wins: 0, bestTime: 0, bestByDino: {} };

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, bestByDino: {} };
    return { ...EMPTY, ...JSON.parse(raw) } as SaveData;
  } catch {
    return { ...EMPTY, bestByDino: {} };
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage unavailable (private mode etc.) — progress simply isn't kept
  }
}

export function recordRun(dino: DinoId, time: number, victory: boolean): SaveData {
  const s = loadSave();
  s.runs += 1;
  if (victory) s.wins += 1;
  s.bestTime = Math.max(s.bestTime, time);
  s.bestByDino[dino] = Math.max(s.bestByDino[dino] ?? 0, time);
  s.lastDino = dino;
  writeSave(s);
  return s;
}
