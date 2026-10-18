import type { DifficultyId } from '../../../data/difficulty';
import { DINO_ORDER, type DinoId } from '../../../data/dinosaurs';
import type { ShopItemDef } from '../../../data/meta';
import type { FirstClear, RunState } from '../RunState';
import { applyClear, applyPurchase, applyRun, emptySave, type RunRecordResult, type SaveData } from '../Save';
import type { SaveStore } from './SaveStore';

const KEY = 'dino-roguelite-save-v1';

/** Guest progress in the browser's localStorage, exactly as before accounts existed. */
export class LocalSaveStore implements SaveStore {
  readonly kind = 'local';

  current(): SaveData {
    return loadLocalSave();
  }

  async recordRun(state: RunState, victory: boolean): Promise<RunRecordResult> {
    const s = loadLocalSave();
    const rewards = applyRun(s, state, victory);
    writeLocalSave(s);
    return { save: s, rewards };
  }

  async recordClear(dino: DinoId, difficulty: DifficultyId): Promise<FirstClear | undefined> {
    const s = loadLocalSave();
    const clear = applyClear(s, dino, difficulty);
    if (clear) writeLocalSave(s);
    return clear;
  }

  async purchase(dino: DinoId, item: ShopItemDef): Promise<SaveData | null> {
    const s = loadLocalSave();
    if (!applyPurchase(s, dino, item)) return null;
    writeLocalSave(s);
    return s;
  }

  rememberDifficulty(dino: DinoId, id: DifficultyId): void {
    const s = loadLocalSave();
    s.difficulty[dino] = id;
    writeLocalSave(s);
  }

  markPatchSeen(version: string): void {
    const s = loadLocalSave();
    s.seenPatch = version;
    writeLocalSave(s);
  }
}

export function loadLocalSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySave();
    // Older saves (before meta-progression / endless mode) simply lack the new fields.
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const save = { ...emptySave(), ...parsed } as SaveData;
    // Before difficulties: players who already won skip Filhote (Normal unlocked for every dino).
    if (!parsed.cleared && save.wins > 0) for (const d of DINO_ORDER) save.cleared[d] = 0;
    return save;
  } catch {
    return emptySave();
  }
}

export function writeLocalSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage unavailable (private mode etc.) — progress simply isn't kept
  }
}

/** Debug helper (?debug, guest only): grants fossils and mastery to every dinosaur. */
export function debugGrant(fossils: number, masteryXp: number): SaveData {
  const s = loadLocalSave();
  s.fossils += fossils;
  for (const d of DINO_ORDER) s.mastery[d] = (s.mastery[d] ?? 0) + masteryXp;
  writeLocalSave(s);
  return s;
}
