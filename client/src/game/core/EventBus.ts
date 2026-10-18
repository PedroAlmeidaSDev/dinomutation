import type { Enemy } from '../entities/enemies/Enemy';
import type { StatusHost, StatusId } from '../statuses/StatusDefinitions';

export interface HitEvent {
  target: Enemy;
  amount: number;
  crit: boolean;
  tags: readonly string[];
  isDot: boolean;
  /** Proc depth: 0 = direct attack, >0 = caused by another effect. Used to stop infinite chains. */
  depth: number;
  killed: boolean;
}

export interface GameEvents {
  onAttack: { tags: readonly string[]; targets: Enemy[]; x: number; y: number; angle: number; repeat: boolean };
  onHit: HitEvent;
  onCrit: HitEvent;
  onKill: { enemy: Enemy; hit: HitEvent };
  /** Fires for every enemy death (including ones not caused by the player). */
  onEnemyDeath: { enemy: Enemy };
  onDamageTaken: { amount: number; attacker?: Enemy; tags: readonly string[] };
  onAbilityUse: { id: string; tags: readonly string[] };
  onDash: { angle: number; momentum: number };
  onDashHit: { enemy: Enemy };
  onDashEnd: { x: number; y: number; momentum: number };
  onLevelUp: { level: number };
  onStatusApplied: { host: StatusHost; status: StatusId; stacks: number };
  onUpgradeAcquired: { id: string; level: number };
  tick: { dt: number };
  banner: { text: string; sub?: string; color?: number };
  /** The story boss died: the scene offers ending the run or continuing into the endless mode. */
  storyBossDefeated: Record<string, never>;
}

export type GameEventName = keyof GameEvents;
type Handler<K extends GameEventName> = (payload: GameEvents[K]) => void;

/**
 * Tiny synchronous event bus. One instance per run; cleared when the run ends,
 * so no listener survives across runs.
 */
export class EventBus {
  private handlers = new Map<GameEventName, Set<(p: unknown) => void>>();

  on<K extends GameEventName>(event: K, fn: Handler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    const wrapped = fn as (p: unknown) => void;
    set.add(wrapped);
    return () => set!.delete(wrapped);
  }

  emit<K extends GameEventName>(event: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;
    for (const fn of [...set]) fn(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
