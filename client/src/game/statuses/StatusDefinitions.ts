import { BALANCE } from '../../data/balance';

export type StatusId = 'bleed' | 'poison' | 'stun' | 'fear' | 'slow';

export interface StatusInstance {
  id: StatusId;
  /** Full duration of the current application. */
  duration: number;
  remaining: number;
  stacks: number;
  /** Damage per second per stack (DoTs), snapshotted when applied. */
  potency: number;
  source: 'player' | 'enemy';
  tickTimer: number;
  /** Stacks applied per origin (upgrade id), to split DoT damage in the run stats. */
  origins?: Record<string, number>;
}

/** Anything that can carry statuses: the player and every enemy. */
export interface StatusHost {
  readonly kind: 'player' | 'enemy';
  x: number;
  y: number;
  statuses: Map<StatusId, StatusInstance>;
  isAlive(): boolean;
  /** 0..1 — reduces crowd-control duration (bosses). */
  ccResist: number;
}

export interface StatusDef {
  id: StatusId;
  name: string;
  color: number;
  maxStacks: number;
  /** Lower stack cap when the host is the player (enemy-applied DoTs). */
  maxStacksOnPlayer?: number;
  baseDuration: number;
  /** DoT tick interval; omit for non-damaging statuses. */
  tickInterval?: number;
  /** Tags attached to DoT damage so upgrades can react to it. */
  damageTags?: string[];
  /** Movement multiplier while active. */
  moveMult?: (inst: StatusInstance) => number;
  /** Stops the host from moving and attacking. */
  preventsAction?: boolean;
  /** Host runs away from the player instead of acting. */
  fleeing?: boolean;
  /** Is it crowd control (affected by ccResist)? */
  crowdControl?: boolean;
}

const S = BALANCE.statuses;

export const STATUS_DEFS: Record<StatusId, StatusDef> = {
  bleed: {
    id: 'bleed',
    name: 'Sangramento',
    color: 0xe0233a,
    maxStacks: S.bleed.maxStacks,
    baseDuration: S.bleed.duration,
    tickInterval: S.bleed.tick,
    damageTags: ['bleed', 'dot'],
  },
  poison: {
    id: 'poison',
    name: 'Veneno',
    color: 0x7ee03a,
    maxStacks: S.poison.maxStacks,
    maxStacksOnPlayer: S.enemyPoisonOnPlayer.maxStacks,
    baseDuration: S.poison.duration,
    tickInterval: S.poison.tick,
    damageTags: ['poison', 'dot'],
    moveMult: (inst) => Math.max(0.75, 1 - inst.stacks * 0.02),
  },
  stun: {
    id: 'stun',
    name: 'Atordoado',
    color: 0xffe066,
    maxStacks: 1,
    baseDuration: 0.8,
    preventsAction: true,
    crowdControl: true,
    moveMult: () => 0,
  },
  fear: {
    id: 'fear',
    name: 'Medo',
    color: 0xb070ff,
    maxStacks: 1,
    baseDuration: 2,
    fleeing: true,
    crowdControl: true,
  },
  slow: {
    id: 'slow',
    name: 'Lento',
    color: 0x6ab8ff,
    maxStacks: 1,
    baseDuration: 2,
    crowdControl: true,
    moveMult: () => S.slow.multiplier,
  },
};
