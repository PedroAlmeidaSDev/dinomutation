import type { ModMode, StatKey } from '../components/StatsComponent';
import type { DamageCalc } from '../combat/DamageSystem';
import type { GameEvents, HitEvent } from '../core/EventBus';
import type { RunContext } from '../core/RunContext';
import type { StatusId } from '../statuses/StatusDefinitions';
import type { EffectParams } from './UpgradeTypes';

/** What every effect handler receives. `state` is shared by all effects of the same upgrade. */
export interface EffectRuntime {
  ctx: RunContext;
  upgradeId: string;
  /** Unique prefix for modifiers created by this effect. */
  key: string;
  params: EffectParams;
  state: Record<string, number>;
  /** Current upgrade power (level, boosted by Evolução Apex). */
  power(): number;
}

export type EffectHandler = (rt: EffectRuntime, payload: any) => void;

const num = (rt: EffectRuntime, name: string, fallback = 0): number => {
  const v = rt.params[name];
  return typeof v === 'number' ? v : fallback;
};
const str = (rt: EffectRuntime, name: string, fallback = ''): string => {
  const v = rt.params[name];
  return typeof v === 'string' ? v : fallback;
};

/**
 * Registry of reusable effect behaviours. Upgrade data references these by name,
 * so most new upgrades only need new data, not new code.
 */
export const EFFECT_HANDLERS: Record<string, EffectHandler> = {
  /** Event adds a stack of a temporary stat buff (Predador Frenético, Frenesi). */
  stackBuff(rt) {
    const s = rt.state;
    s.stacks = Math.min(num(rt, 'max', 10), (s.stacks ?? 0) + 1);
    s.timer = num(rt, 'duration', 3);
    applyStacks(rt);
  },

  /** Companion of stackBuff: drops all stacks when the buff runs out. */
  stackDecay(rt, p: GameEvents['tick']) {
    const s = rt.state;
    if (!s.stacks) return;
    s.timer -= p.dt;
    if (s.timer <= 0) {
      s.stacks = 0;
      applyStacks(rt);
    }
  },

  /** Stat buff scaling with how many nearby enemies carry a status (Sangue Quente). */
  nearbyStatusBuff(rt, p: GameEvents['tick']) {
    const s = rt.state;
    s.timer = (s.timer ?? 0) - p.dt;
    if (s.timer > 0) return;
    s.timer = 0.25;
    const { ctx } = rt;
    const status = str(rt, 'status', 'bleed') as StatusId;
    let n = 0;
    for (const e of ctx.queryEnemies(ctx.player.x, ctx.player.y, num(rt, 'radius', 300))) {
      if (ctx.status.has(e, status)) n++;
    }
    const value = Math.min(num(rt, 'max', 0.6) * rt.power(), n * num(rt, 'per', 0.04) * rt.power());
    const id = `${rt.key}:nearby`;
    if (value > 0) ctx.player.stats.setModifier(id, str(rt, 'stat', 'damage') as StatKey, 'mult', value);
    else ctx.player.stats.removeModifier(id);
  },

  /** Heal when hitting an enemy that has a status, with internal cooldown (Hemofagia). */
  healOnStatusHit(rt, hit: HitEvent) {
    const { ctx } = rt;
    const now = ctx.run.elapsedTime;
    if (now < (rt.state.next ?? 0)) return;
    if (!ctx.status.has(hit.target, str(rt, 'status', 'bleed') as StatusId) && !hit.tags.includes('bleed')) return;
    rt.state.next = now + num(rt, 'icd', 0.2);
    const healed = ctx.player.health.heal(num(rt, 'amount', 1) * rt.power());
    if (healed > 0.5 && Math.random() < 0.25) ctx.fx.floatText(ctx.player.x, ctx.player.y - 34, `+${Math.round(healed)}`, '#6aff8a', 13);
  },

  /** Bonus crit chance vs wounded enemies (Instinto Assassino). */
  lowHpCrit(rt, calc: DamageCalc) {
    if (calc.target.hpRatio < num(rt, 'threshold', 0.5)) calc.critChance += num(rt, 'bonus', 0.2) * rt.power();
  },

  /** Bonus damage vs wounded enemies, instakill below a threshold (Execução). */
  execute(rt, calc: DamageCalc) {
    const ratio = calc.target.hpRatio;
    if (ratio < num(rt, 'threshold', 0.3)) calc.bonus += num(rt, 'bonus', 0.35) * rt.power();
    if (!calc.isDot && !calc.target.isBossLike && ratio < num(rt, 'instakill', 0.06) * rt.power()) calc.execute = true;
  },

  /** Bonus damage vs enemies with a status (Concussão, Toxinas Corrosivas). */
  bonusVsStatus(rt, calc: DamageCalc) {
    if (rt.ctx.status.has(calc.target, str(rt, 'status') as StatusId)) calc.bonus += num(rt, 'bonus', 0.25) * rt.power();
  },

  reduceCooldown(rt) {
    rt.ctx.abilities.reduce(num(rt, 'seconds', 0.2) * rt.power());
  },

  healFlat(rt) {
    rt.ctx.player.health.heal(num(rt, 'amount', 1) * rt.power());
  },

  /** Reflect melee damage (Espinhos). */
  thorns(rt, p: GameEvents['onDamageTaken']) {
    const { ctx } = rt;
    if (!p.attacker || p.attacker.dead || !p.tags.includes('melee')) return;
    const armor = Math.max(0, ctx.player.stats.get('armor'));
    const dmg = (num(rt, 'flat', 10) + armor * num(rt, 'armorScale', 0.8)) * rt.power();
    ctx.damage.hitEnemy({ target: p.attacker, base: dmg, tags: ['thorns', 'reflect'], canCrit: false, rawBase: true, depth: 1, noProcs: true });
    ctx.fx.hitSpark(p.attacker.x, p.attacker.y);
  },

  /** Temporary stat buff on an event (Placas Ósseas). */
  timedStat(rt) {
    rt.ctx.player.stats.addTimed(
      `${rt.key}:timed`,
      str(rt, 'stat', 'damageReduction') as StatKey,
      str(rt, 'mode', 'add') as ModMode,
      num(rt, 'value', 0.1) * rt.power(),
      num(rt, 'duration', 3),
    );
  },

  /** Area burst around the player (Impacto Sísmico, Sangue Ácido). */
  aoeBurst(rt) {
    const { ctx } = rt;
    if (Math.random() >= num(rt, 'chance', 1)) return;
    const p = ctx.player;
    const radius = num(rt, 'radius', 150) * Math.sqrt(p.stats.get('size')) * (1 + (rt.power() - 1) * 0.15);
    const coef = num(rt, 'coef', 1) * rt.power();
    const stun = num(rt, 'stun', 0);
    const poison = num(rt, 'poison', 0);
    const knock = num(rt, 'knockback', 0);
    const tag = str(rt, 'tag', 'aoe');
    const x = p.x;
    const y = p.y;
    ctx.fx.explosion(x, y, radius, num(rt, 'color', 0xffc070), str(rt, 'particles', 'spark') as 'spark');
    ctx.fx.shake(0.005, 120);
    ctx.defer(() => {
      for (const e of ctx.queryEnemies(x, y, radius)) {
        if (e.dead) continue;
        ctx.damage.hitEnemy({ target: e, base: p.stats.get('damage') * coef, tags: ['aoe', tag], depth: 1, knockback: knock, knockAngle: Math.atan2(e.y - y, e.x - x) });
        if (stun > 0) ctx.status.apply(e, 'stun', { duration: stun });
        if (poison > 0) ctx.status.apply(e, 'poison', { stacks: Math.round(poison * rt.power()) });
      }
    });
  },

  /** Dash damage scales with built-up momentum (Massa Imparável). */
  momentumBonus(rt, calc: DamageCalc) {
    if (!calc.tags.includes('dash')) return;
    calc.bonus += rt.ctx.player.dashMomentum * num(rt, 'bonus', 1) * rt.power();
  },

  /** Stat buffs while under a HP threshold (Adrenalina). */
  lowHpBuff(rt) {
    const { player } = rt.ctx;
    const active = player.health.ratio < num(rt, 'threshold', 0.3);
    const idMove = `${rt.key}:move`;
    const idAtk = `${rt.key}:atk`;
    if (active) {
      player.stats.setModifier(idMove, 'moveSpeed', 'mult', num(rt, 'moveSpeed', 0.25) * rt.power());
      player.stats.setModifier(idAtk, 'attackSpeed', 'mult', num(rt, 'attackSpeed', 0.3) * rt.power());
    } else if (player.stats.hasModifier(idMove)) {
      player.stats.removeModifier(idMove);
      player.stats.removeModifier(idAtk);
    }
  },

  /** Kills can terrify nearby enemies (Predador Alfa). */
  fearOnKill(rt, p: GameEvents['onKill']) {
    const { ctx } = rt;
    if (Math.random() >= Math.min(0.6, num(rt, 'chance', 0.15) * rt.power())) return;
    const { x, y } = p.enemy;
    ctx.fx.fearBurst(x, y);
    ctx.fx.ring(x, y, num(rt, 'radius', 180), 0xb070ff, 350);
    for (const e of ctx.queryEnemies(x, y, num(rt, 'radius', 180))) {
      ctx.status.apply(e, 'fear', { duration: num(rt, 'duration', 2) });
    }
  },

  /** Ability use terrifies enemies around the player (Presença Aterrorizante). */
  fearPulse(rt) {
    const { ctx } = rt;
    const r = num(rt, 'radius', 270);
    ctx.fx.ring(ctx.player.x, ctx.player.y, r, 0xb070ff, 420);
    for (const e of ctx.queryEnemies(ctx.player.x, ctx.player.y, r)) {
      ctx.status.apply(e, 'fear', { duration: num(rt, 'duration', 1.8) * rt.power() });
    }
  },

  /** Every N attacks, spin the tail (Cauda Clava). */
  tailSwipe(rt, p: GameEvents['onAttack']) {
    if (p.repeat) return;
    const s = rt.state;
    s.count = (s.count ?? 0) + 1;
    if (s.count < num(rt, 'every', 4)) return;
    s.count = 0;
    const { ctx } = rt;
    const pl = ctx.player;
    const radius = num(rt, 'radius', 115) * Math.sqrt(pl.stats.get('size'));
    ctx.fx.ring(pl.x, pl.y, radius, 0xd0b080, 260);
    ctx.fx.dust(pl.x, pl.y, 8);
    ctx.defer(() => {
      for (const e of ctx.queryEnemies(pl.x, pl.y, radius)) {
        if (e.dead) continue;
        ctx.damage.hitEnemy({
          target: e, base: pl.stats.get('damage') * num(rt, 'coef', 0.9) * rt.power(), tags: ['tail', 'aoe', 'impact'],
          depth: 1, knockback: num(rt, 'knockback', 380), knockAngle: Math.atan2(e.y - pl.y, e.x - pl.x),
        });
      }
    });
  },

  /** Periodic spectral raptors (Matilha Fantasma; enhanced by the Matilha flag). */
  summonGhosts(rt, p: GameEvents['tick']) {
    const s = rt.state;
    const { ctx } = rt;
    s.timer = (s.timer ?? 1) - p.dt;
    if (s.timer > 0) return;
    const pack = ctx.player.flags.has('packPersist');
    s.timer = num(rt, 'interval', 5) * (pack ? 1.2 : 1);
    const count = Math.max(1, Math.floor(rt.power())) + (pack ? 1 : 0);
    for (let i = 0; i < count; i++) {
      ctx.summons.spawnGhost(pack
        ? { coef: num(rt, 'coef', 1.5) * 0.8, hits: Infinity, life: 6, attackCooldown: 0.45 }
        : { coef: num(rt, 'coef', 1.5), hits: 1, life: 4, attackCooldown: 0 });
    }
  },

  /** Bleeding enemies explode on death and spread their bleed (Tempestade de Sangue). */
  bleedExplosion(rt, p: GameEvents['onKill']) {
    const { ctx } = rt;
    const e = p.enemy;
    const bleed = ctx.status.get(e, 'bleed');
    if (!bleed) return;
    const x = e.x;
    const y = e.y;
    const radius = num(rt, 'radius', 160) * (e.isBossLike ? 1.5 : 1);
    const dmg = bleed.stacks * bleed.potency * num(rt, 'perStack', 0.6) * 4 * rt.power();
    const spread = Math.max(1, Math.round(bleed.stacks * num(rt, 'spread', 0.6)));
    ctx.fx.explosion(x, y, radius, 0xff2030, 'blood');
    ctx.defer(() => {
      for (const t of ctx.queryEnemies(x, y, radius)) {
        if (t.dead || t === e) continue;
        ctx.damage.hitEnemy({ target: t, base: dmg, tags: ['bleed', 'aoe', 'explosion'], rawBase: true, canCrit: false, depth: 2, noProcs: true });
        if (!t.dead) ctx.status.apply(t, 'bleed', { stacks: spread, potency: bleed.potency });
      }
    });
  },

  /** Armor converts into damage (Fortaleza Viva). */
  armorToDamage(rt, calc: DamageCalc) {
    const armor = Math.max(0, rt.ctx.player.stats.get('armor'));
    calc.bonus += armor * num(rt, 'perArmor', 0.012) * rt.power();
  },

  /** Enemies touching the player get crushed (Colosso). */
  colossusCrush(rt, p: GameEvents['tick']) {
    const s = rt.state;
    s.timer = (s.timer ?? 0) - p.dt;
    if (s.timer > 0) return;
    s.timer = num(rt, 'interval', 0.35);
    const { ctx } = rt;
    const pl = ctx.player;
    for (const e of ctx.queryEnemies(pl.x, pl.y, pl.radius + 8)) {
      if (e.dead || e.isBossLike) continue;
      const dmg = pl.stats.get('damage') * num(rt, 'coef', 0.4) + e.maxHp * num(rt, 'hpPercent', 0.04);
      ctx.damage.hitEnemy({ target: e, base: dmg, tags: ['size', 'impact'], rawBase: true, canCrit: false, depth: 1, knockback: 260, knockAngle: Math.atan2(e.y - pl.y, e.x - pl.x) });
      ctx.fx.dust(e.x, e.y, 3);
    }
  },
};

function applyStacks(rt: EffectRuntime): void {
  const s = rt.state;
  const id = `${rt.key}:stacks`;
  const stat = str(rt, 'stat', 'attackSpeed') as StatKey;
  if (!s.stacks) rt.ctx.player.stats.removeModifier(id);
  else rt.ctx.player.stats.setModifier(id, stat, 'mult', s.stacks * num(rt, 'perStack', 0.04) * rt.power());
}
