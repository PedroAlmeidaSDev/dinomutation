import type { AbilityId } from '../../data/dinosaurs';
import type { RunContext } from '../core/RunContext';
import type { Ability } from './Ability';
import { ChargeAbility } from './ChargeAbility';
import { PounceAbility } from './PounceAbility';
import { RoarAbility } from './RoarAbility';

const ABILITIES: Record<AbilityId, () => Ability> = {
  roar: () => new RoarAbility(),
  pounce: () => new PounceAbility(),
  charge: () => new ChargeAbility(),
};

/** Owns the active ability and its cooldown (affected by cooldownReduction). */
export class AbilitySystem {
  readonly ability: Ability;
  remaining = 0;

  constructor(private readonly ctx: RunContext, id: AbilityId) {
    this.ability = ABILITIES[id]();
  }

  get cooldown(): number {
    const cdr = Math.min(0.6, this.ctx.player.stats.get('cooldownReduction'));
    return this.ability.baseCooldown * (1 - cdr);
  }

  get ready(): boolean {
    return this.remaining <= 0;
  }

  /** 0 = just used, 1 = ready. */
  get readiness(): number {
    return 1 - Math.max(0, this.remaining) / this.cooldown;
  }

  tryActivate(): boolean {
    const p = this.ctx.player;
    if (!this.ready || !p.isAlive() || p.isDashing) return false;
    this.remaining = this.cooldown;
    this.ability.activate(this.ctx);
    this.ctx.bus.emit('onAbilityUse', { id: this.ability.id, tags: this.ability.tags });
    return true;
  }

  reduce(seconds: number): void {
    this.remaining = Math.max(0, this.remaining - seconds);
  }

  update(dt: number): void {
    if (this.remaining > 0) this.remaining -= dt;
  }
}
