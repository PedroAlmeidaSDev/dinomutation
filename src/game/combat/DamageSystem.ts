import { BALANCE } from '../../data/balance';
import type { HitEvent } from '../core/EventBus';
import type { RunContext } from '../core/RunContext';
import type { Enemy } from '../entities/enemies/Enemy';
import type { StatusId } from '../statuses/StatusDefinitions';

export interface EnemyHitRequest {
  target: Enemy;
  /** Base damage before the pipeline. Usually player damage × attack coefficient. */
  base: number;
  tags: readonly string[];
  canCrit?: boolean;
  isDot?: boolean;
  depth?: number;
  knockback?: number;
  knockAngle?: number;
  /** Skip tag/global damage multipliers (already baked in, e.g. DoT potency). */
  rawBase?: boolean;
  /** Skip upgrade on-hit status procs. */
  noProcs?: boolean;
  /** Extra multiplier applied by the caller (e.g. ability scaling). */
  mult?: number;
}

/** Mutable damage calculation passed through outgoing modifiers. */
export interface DamageCalc {
  target: Enemy;
  base: number;
  tags: readonly string[];
  isDot: boolean;
  depth: number;
  /** Additive % bonus, final damage × (1 + bonus). */
  bonus: number;
  /** Independent multiplier. */
  more: number;
  critChance: number;
  critDamage: number;
  canCrit: boolean;
  /** Kill the target outright (Execução). */
  execute: boolean;
}

export interface PlayerHitRequest {
  amount: number;
  attacker?: Enemy;
  tags: readonly string[];
  ignoreIFrames?: boolean;
  knockAngle?: number;
  knockForce?: number;
  /** No flash/shake (DoTs). */
  silent?: boolean;
  /** 0..1 — share of the player's damage reduction this hit ignores (boss attacks). */
  pierce?: number;
}

export interface IncomingCalc {
  amount: number;
  attacker?: Enemy;
  tags: readonly string[];
  reduction: number;
}

/** "Chance to apply status on hit" entries, compiled from upgrades. */
export interface StatusProc {
  key: string;
  status: StatusId;
  chance: number;
  stacks: number;
  duration?: number;
  /** Attack must carry any of these tags (all attacks if omitted). */
  tags?: readonly string[];
}

type OutgoingModifier = (calc: DamageCalc) => void;
type IncomingModifier = (calc: IncomingCalc) => void;

/**
 * The single damage pipeline:
 * base → tag/global bonuses → conditional modifiers → crit → target armor → apply
 * → onHit / onCrit → on-hit statuses → onKill.
 */
export class DamageSystem {
  private outgoing = new Set<OutgoingModifier>();
  private incoming = new Set<IncomingModifier>();
  private statusProcs: StatusProc[] = [];
  invincible = false;

  constructor(private readonly ctx: RunContext) {}

  addOutgoingModifier(fn: OutgoingModifier): () => void {
    this.outgoing.add(fn);
    return () => this.outgoing.delete(fn);
  }

  addIncomingModifier(fn: IncomingModifier): () => void {
    this.incoming.add(fn);
    return () => this.incoming.delete(fn);
  }

  setStatusProcs(procs: StatusProc[]): void {
    this.statusProcs = procs;
  }

  hitEnemy(req: EnemyHitRequest): HitEvent | null {
    const target = req.target;
    if (target.dead) return null;
    const player = this.ctx.player;
    const stats = player.stats;
    const isDot = !!req.isDot;
    const depth = req.depth ?? 0;

    const calc: DamageCalc = {
      target,
      base: req.base * (req.mult ?? 1),
      tags: req.tags,
      isDot,
      depth,
      bonus: req.rawBase ? 0 : stats.tagDamageBonus(req.tags),
      more: 1,
      critChance: stats.get('critChance'),
      critDamage: stats.get('critDamage'),
      canCrit: req.canCrit !== false && !isDot,
      execute: false,
    };
    for (const mod of this.outgoing) mod(calc);

    const crit = calc.canCrit && Math.random() < calc.critChance;
    let amount = calc.base * (1 + calc.bonus) * calc.more;
    if (crit) amount *= calc.critDamage;
    // Target modifiers: armor.
    amount *= BALANCE.combat.enemyArmorConstant / (BALANCE.combat.enemyArmorConstant + target.armor);
    if (calc.execute && !target.isBossLike) amount = Math.max(amount, target.hp);
    amount = Math.max(1, Math.round(amount));

    const applied = target.takeDamage(amount);
    this.ctx.run.damageDealt += applied;

    // Feedback
    if (!isDot) target.flash();
    this.ctx.fx.damageNumber(target.x, target.y - target.radius, amount, crit, calc.execute, isDot ? req.tags[0] : undefined);
    if (req.knockback && req.knockback > 0) {
      const angle = req.knockAngle ?? Math.atan2(target.y - player.y, target.x - player.x);
      target.applyKnockback(angle, req.knockback * stats.get('knockback'));
    }
    if (crit) {
      this.ctx.fx.critBurst(target.x, target.y);
      this.ctx.hitstop(BALANCE.feel.hitstopCrit);
    }

    const killed = target.hp <= 0;
    const hit: HitEvent = { target, amount, crit, tags: req.tags, isDot, depth, killed };

    this.ctx.bus.emit('onHit', hit);
    if (crit) this.ctx.bus.emit('onCrit', hit);

    if (!req.noProcs && !isDot && !killed) this.rollStatusProcs(target, req.tags);

    if (killed && !target.dead) {
      target.dead = true;
      this.ctx.bus.emit('onKill', { enemy: target, hit });
    }
    return hit;
  }

  private rollStatusProcs(target: Enemy, tags: readonly string[]): void {
    for (const p of this.statusProcs) {
      if (p.tags && p.tags.length && !p.tags.some((t) => tags.includes(t))) continue;
      if (Math.random() >= p.chance) continue;
      this.ctx.status.apply(target, p.status, { stacks: p.stacks, duration: p.duration });
    }
  }

  /** Returns damage actually taken. */
  hitPlayer(req: PlayerHitRequest): number {
    const player = this.ctx.player;
    if (!player.isAlive()) return 0;
    if (this.invincible || player.isInvulnerable) return 0;
    if (!req.ignoreIFrames && player.iFrames > 0) return 0;

    const armor = player.stats.get('armor');
    const armorReduction = armor >= 0
      ? 1 - BALANCE.combat.armorConstant / (BALANCE.combat.armorConstant + armor)
      : armor / BALANCE.combat.armorConstant; // negative armor increases damage
    const calc: IncomingCalc = {
      amount: req.amount,
      attacker: req.attacker,
      tags: req.tags,
      reduction: player.stats.get('damageReduction'),
    };
    for (const mod of this.incoming) mod(calc);
    const reduction = Math.min(BALANCE.combat.maxDamageReduction, armorReduction + calc.reduction) * (1 - (req.pierce ?? 0));
    const amount = Math.max(req.silent ? 0.2 : 1, calc.amount * (1 - reduction));

    const taken = player.health.damage(amount);
    this.ctx.run.damageTaken += taken;
    if (!req.ignoreIFrames) player.iFrames = BALANCE.player.iFrames;

    if (!req.silent) {
      player.flash();
      this.ctx.fx.playerHurt(player.x, player.y, Math.round(taken));
      this.ctx.fx.shake(taken > 20 ? BALANCE.feel.shakeMedium : BALANCE.feel.shakeLight, 120);
    }
    if (req.knockAngle !== undefined && req.knockForce) player.applyKnockback(req.knockAngle, req.knockForce);

    this.ctx.bus.emit('onDamageTaken', { amount: taken, attacker: req.attacker, tags: req.tags });
    return taken;
  }
}
