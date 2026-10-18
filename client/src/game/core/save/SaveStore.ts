import type { DifficultyId } from '../../../data/difficulty';
import type { DinoId } from '../../../data/dinosaurs';
import type { ShopItemDef } from '../../../data/meta';
import type { FirstClear, RunState } from '../RunState';
import type { RunRecordResult, SaveData } from '../Save';
import { LocalSaveStore } from './LocalSaveStore';

/**
 * Where progress lives: the browser (guest) or the API (signed in). Reads are synchronous
 * (scenes draw from current()); writes are commands that resolve with the updated save.
 */
export interface SaveStore {
  readonly kind: 'local' | 'cloud';
  current(): SaveData;
  recordRun(state: RunState, victory: boolean): Promise<RunRecordResult>;
  /** Saved the moment the story boss falls (the player may quit mid-endless). */
  recordClear(dino: DinoId, difficulty: DifficultyId): Promise<FirstClear | undefined>;
  /** Resolves with the updated save, or null when the purchase isn't allowed. */
  purchase(dino: DinoId, item: ShopItemDef): Promise<SaveData | null>;
  rememberDifficulty(dino: DinoId, id: DifficultyId): void;
  markPatchSeen(version: string): void;
}

let active: SaveStore | null = null;

export function saveStore(): SaveStore {
  return (active ??= new LocalSaveStore());
}

export function setSaveStore(store: SaveStore): void {
  active = store;
}
