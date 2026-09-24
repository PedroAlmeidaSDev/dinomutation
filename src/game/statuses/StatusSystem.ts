import { BALANCE } from '../../data/balance';
import type { RunContext } from '../core/RunContext';
import type { Enemy } from '../entities/enemies/Enemy';
import { STATUS_DEFS, type StatusHost, type StatusId, type StatusInstance } from './StatusDefinitions';

export interface ApplyStatusOptions {
  stacks?: number;
  duration?: number;
  /** DoT damage per second per stack. Defaults to the player-scaled value. */
  potency?: number;
  source?: 'player' | 'enemy';
}

/**
 * Owns all status logic. Hosts only store instances; they ask this system
 * whether they may act, how fast they may move and whether they are fleeing.
 */
export class StatusSystem {
  constructor(private readonly ctx: RunContext) {}

  apply(host: StatusHost, id: StatusId, opts: ApplyStatusOptions = {}): void {
    if (!host.isAlive()) return;
    const def = STATUS_DEFS[id];
    const source = opts.source ?? 'player';
    let duration = opts.duration ?? def.baseDuration;
    if (def.crowdControl) duration *= 1 - host.ccResist;
    if (duration <= 0.05) return;
    const stacks = Math.max(1, Math.round(opts.stacks ?? 1));
    const potency = opts.potency ?? this.defaultPotency(id, source);
    const cap = host.kind === 'player' ? def.maxStacksOnPlayer ?? def.maxStacks : def.maxStacks;

    const existing = host.statuses.get(id);
    if (existing) {
      existing.stacks = Math.min(cap, existing.stacks + stacks);
      existing.remaining = Math.max(existing.remaining, duration);
      existing.duration = Math.max(existing.duration, duration);
      existing.potency = Math.max(existing.potency, potency);
    } else {
      host.statuses.set(id, {
        id,
        duration,
        remaining: duration,
        stacks: Math.min(cap, stacks),
        potency,
        source,
        tickTimer: def.tickInterval ?? 0,
      });
    }
    this.ctx.bus.emit('onStatusApplied', { host, status: id, stacks });
  }

  defaultPotency(id: StatusId, source: 'player' | 'enemy'): number {
    const S = BALANCE.statuses;
    if (source === 'enemy') {
      return id === 'poison' ? S.enemyPoisonOnPlayer.dpsPerStack : 1;
    }
    const stats = this.ctx.player.stats;
    if (id === 'bleed') return (S.bleed.dpsPerStack + stats.get('damage') * S.bleed.damageScaling) * stats.get('bleedDamage');
    if (id === 'poison') return (S.poison.dpsPerStack + stats.get('damage') * S.poison.damageScaling) * stats.get('poisonDamage');
    return 0;
  }

  get(host: StatusHost, id: StatusId): StatusInstance | undefined {
    return host.statuses.get(id);
  }

  has(host: StatusHost, id: StatusId): boolean {
    return host.statuses.has(id);
  }

  stacks(host: StatusHost, id: StatusId): number {
    return host.statuses.get(id)?.stacks ?? 0;
  }

  remove(host: StatusHost, id: StatusId): void {
    host.statuses.delete(id);
  }

  canAct(host: StatusHost): boolean {
    for (const inst of host.statuses.values()) {
      if (STATUS_DEFS[inst.id].preventsAction) return false;
    }
    return true;
  }

  isFleeing(host: StatusHost): boolean {
    for (const inst of host.statuses.values()) {
      if (STATUS_DEFS[inst.id].fleeing) return true;
    }
    return false;
  }

  moveMult(host: StatusHost): number {
    let m = 1;
    for (const inst of host.statuses.values()) {
      const f = STATUS_DEFS[inst.id].moveMult;
      if (f) m *= f(inst);
    }
    return m;
  }

  update(dt: number, hosts: readonly StatusHost[]): void {
    for (const host of hosts) {
      if (host.statuses.size === 0 || !host.isAlive()) continue;
      for (const inst of [...host.statuses.values()]) {
        const def = STATUS_DEFS[inst.id];
        if (def.tickInterval) {
          inst.tickTimer -= dt;
          while (inst.tickTimer <= 0 && host.isAlive()) {
            inst.tickTimer += def.tickInterval;
            this.tickDot(host, inst, def.tickInterval, def.damageTags ?? []);
          }
        }
        inst.remaining -= dt;
        if (inst.remaining <= 0) host.statuses.delete(inst.id);
      }
    }
  }

  private tickDot(host: StatusHost, inst: StatusInstance, interval: number, tags: string[]): void {
    const amount = inst.potency * inst.stacks * interval;
    if (amount <= 0) return;
    if (host.kind === 'enemy') {
      this.ctx.damage.hitEnemy({
        target: host as Enemy,
        base: amount,
        tags,
        isDot: true,
        canCrit: false,
        depth: 1,
        rawBase: true,
      });
      if (inst.id === 'bleed' && Math.random() < 0.5) this.ctx.fx.bleedDrip(host.x, host.y);
    } else {
      this.ctx.damage.hitPlayer({ amount, tags, ignoreIFrames: true, silent: true });
    }
  }
}
