import { DIFFICULTY_BY_ID, difficultyIndex, type DifficultyId } from '../../../data/difficulty';
import type { DinoId } from '../../../data/dinosaurs';
import type { ShopItemDef } from '../../../data/meta';
import { ApiError, api } from '../../../net/api';
import type { FirstClear, RunState } from '../RunState';
import {
  applyRun, emptySave, unlocksBetween, type RunRecordResult, type RunRewards, type SaveData,
} from '../Save';
import type {
  Account, ClearResponse, PurchaseResponse, RunRequest, RunResponse, RunRewardsDto, SaveDto,
} from './apiTypes';
import { enqueuePendingRun, flushPendingRuns } from './pendingRuns';
import type { SaveStore } from './SaveStore';

/** API caps (RunRequest on the server). */
const MAX_ELAPSED = 14400;
const MAX_UPGRADES = 100;

/**
 * Signed-in progress: the API is the source of truth. The save is held in memory for the
 * scenes and replaced by the server's copy after every command.
 */
export class CloudSaveStore implements SaveStore {
  readonly kind = 'cloud';

  private constructor(private save: SaveData, readonly account: Account) {}

  /** Loads the account, first sending runs a failed save left in the queue. */
  static async open(): Promise<CloudSaveStore> {
    let dto = await api<SaveDto>('/players/me/save');
    if (await flushPendingRuns(dto.email)) dto = await api<SaveDto>('/players/me/save');
    return CloudSaveStore.from(dto);
  }

  static from(dto: SaveDto): CloudSaveStore {
    return new CloudSaveStore(toSaveData(dto), { email: dto.email, displayName: dto.displayName });
  }

  current(): SaveData {
    return this.save;
  }

  async recordRun(state: RunState, victory: boolean): Promise<RunRecordResult> {
    const req = toRunRequest(state, victory);
    try {
      const res = await api<RunResponse>('/runs', { method: 'POST', body: req });
      this.save = toSaveData(res.save);
      return { save: this.save, rewards: toRewards(state, res.rewards) };
    } catch (e) {
      if (!isRetryable(e)) throw e;
      enqueuePendingRun(this.account.email, req);
      // Preview only: the server stays the source of truth and pays when the queue is sent.
      const preview = structuredClone(this.save);
      return { save: preview, rewards: applyRun(preview, state, victory), pending: true };
    }
  }

  async recordClear(dino: DinoId, difficulty: DifficultyId): Promise<FirstClear | undefined> {
    try {
      const res = await api<ClearResponse>('/clears', { method: 'POST', body: { dino, difficulty }, keepalive: true });
      if (!res.firstWinBonus) return undefined;
      // Local preview of what the server just paid (unlock + bonus); every later server
      // response replaces the whole save, so this can't drift.
      const idx = difficultyIndex(difficulty);
      if (idx > (this.save.cleared[dino] ?? -1)) this.save.cleared[dino] = idx;
      this.save.fossils += res.firstWinBonus;
      return {
        firstWinBonus: res.firstWinBonus,
        unlockedDifficulty: res.unlockedDifficulty && DIFFICULTY_BY_ID[res.unlockedDifficulty].name,
      };
    } catch {
      // POST /api/runs applies the clear too, so a lost request costs nothing.
      return undefined;
    }
  }

  async purchase(dino: DinoId, item: ShopItemDef): Promise<SaveData | null> {
    try {
      const res = await api<PurchaseResponse>('/shop/purchases', { method: 'POST', body: { dino, itemId: item.id } });
      this.save = toSaveData(res.save);
      return this.save;
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'INSUFFICIENT_FOSSILS' || e.code === 'ITEM_MAXED')) return null;
      throw e;
    }
  }

  rememberDifficulty(dino: DinoId, id: DifficultyId): void {
    this.save.difficulty[dino] = id;
    this.patch({ difficulty: { dino, id } });
  }

  markPatchSeen(version: string): void {
    this.save.seenPatch = version;
    this.patch({ seenPatch: version });
  }

  private patch(body: object): void {
    api('/players/me/preferences', { method: 'PATCH', body }).catch((e) => console.warn('Preferência não salva.', e));
  }
}

/** The API's save without the account fields, with every missing map filled in. */
export function toSaveData(dto: SaveDto): SaveData {
  const { email: _email, displayName: _name, ...save } = dto;
  return { ...emptySave(), ...save };
}

function toRunRequest(state: RunState, victory: boolean): RunRequest {
  return {
    id: state.id,
    dino: state.dinosaur,
    difficulty: state.difficulty,
    victory,
    elapsedTime: Math.min(state.elapsedTime, MAX_ELAPSED),
    kills: state.kills,
    level: state.level,
    eliteKilled: state.eliteKilled,
    bossKilled: state.bossKilled,
    endless: state.endless,
    era: state.era,
    endlessTime: Math.min(state.endlessTime, MAX_ELAPSED),
    damageDealt: state.damageDealt,
    damageTaken: state.damageTaken,
    upgrades: state.upgrades.slice(0, MAX_UPGRADES),
  };
}

/**
 * The server's rewards as the result screen shows them. When the boss fell, /api/clears already
 * paid the first-win bonus, so /api/runs reports 0 for it: the screen shows the clear's bonus
 * and unlock instead (display only; the save always comes from the server).
 */
function toRewards(state: RunState, r: RunRewardsDto): RunRewards {
  const clear = r.firstWinBonus === 0 ? state.firstClear : undefined;
  return {
    fossils: r.fossils + (clear?.firstWinBonus ?? 0),
    firstWinBonus: clear?.firstWinBonus ?? r.firstWinBonus,
    unlockedDifficulty: clear
      ? clear.unlockedDifficulty
      : r.unlockedDifficulty && DIFFICULTY_BY_ID[r.unlockedDifficulty].name,
    masteryXp: r.masteryXp,
    levelBefore: r.levelBefore,
    levelAfter: r.levelAfter,
    unlocks: unlocksBetween(state.dinosaur, r.levelBefore, r.levelAfter),
  };
}

/** Network down or a server error: worth queueing. A 4xx means the API refused this run. */
function isRetryable(e: unknown): boolean {
  return e instanceof ApiError && (e.offline || e.status >= 500);
}
