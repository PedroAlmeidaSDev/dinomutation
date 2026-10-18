import type { RunContext } from '../core/RunContext';
import type { Enemy } from '../entities/enemies/Enemy';
import { circleInCone } from '../../utils/math';

/**
 * Semi-automatic basic attack. Picks the nearest valid enemy in range and swings
 * according to the dinosaur's attack definition (bite / claw / horn).
 */
export class AutoAttackSystem {
  private timer = 0.3;
  private repeats: number[] = [];
  private clawSide = 1;

  constructor(private readonly ctx: RunContext) {}

  get range(): number {
    const s = this.ctx.player.stats;
    return s.get('attackRange') * Math.sqrt(s.get('size'));
  }

  update(dt: number): void {
    const p = this.ctx.player;
    if (!p.isAlive()) return;

    for (let i = this.repeats.length - 1; i >= 0; i--) {
      this.repeats[i] -= dt;
      if (this.repeats[i] <= 0) {
        this.repeats.splice(i, 1);
        this.tryAttack(true);
      }
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.tryAttack(false)) this.timer = 1 / Math.max(0.1, p.stats.get('attackSpeed'));
      else this.timer = 0;
    }
  }

  private tryAttack(repeat: boolean): boolean {
    const ctx = this.ctx;
    const p = ctx.player;
    const range = this.range;
    const target = ctx.nearestEnemy(p.x, p.y, range + p.radius * 0.5, (e) => !e.dead);
    if (!target) return false;

    const atk = p.def.attack;
    const angle = Math.atan2(target.y - p.y, target.x - p.x);
    const arc = p.stats.get('attackArc');
    const reach = range + p.radius * 0.5;
    const carnage = p.flags.has('carnage');
    const maxTargets = carnage ? Infinity : atk.maxTargets + Math.floor(p.stats.get('extraTargets'));

    const targets: Enemy[] = [target];
    if (maxTargets > 1) {
      const nearby = ctx.queryEnemies(p.x, p.y, reach + 10)
        .filter((e) => e !== target && !e.dead && circleInCone(e.x, e.y, e.radius, p.x, p.y, angle, arc, reach))
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
      for (const e of nearby) {
        if (targets.length >= maxTargets) break;
        targets.push(e);
      }
    }

    p.aimAt(angle);
    const size = p.stats.get('size');
    const bloody = p.flags.has('vfx_bleed');

    // Visuals first so hits feel attached to the swing.
    if (atk.kind === 'bite') {
      const s = (0.9 + (range - 90) / 160) * size;
      ctx.fx.bite(target.x, target.y, angle, Math.max(0.8, s), bloody);
      if (carnage) ctx.fx.swipe(p.x, p.y, angle, reach, arc, 0xff5050);
    } else if (atk.kind === 'claw') {
      this.clawSide = -this.clawSide;
      ctx.fx.claw(target.x, target.y, angle + this.clawSide * 0.3, 0.8 * size, bloody ? 0xff7080 : 0xffffff);
      if (carnage) ctx.fx.swipe(p.x, p.y, angle, reach, arc, 0xff9090);
    } else {
      ctx.fx.swipe(p.x, p.y, angle, reach, arc, 0xffe9b0);
    }

    const base = p.stats.get('damage') * atk.coef;
    for (const e of targets) {
      ctx.damage.hitEnemy({
        target: e,
        base,
        tags: atk.tags,
        source: 'attack',
        knockback: atk.knockback,
        knockAngle: Math.atan2(e.y - p.y, e.x - p.x),
      });
    }

    if (atk.hitstop > 0) ctx.hitstop(atk.hitstop);
    if (atk.shake > 0) ctx.fx.shake(atk.shake, 70);

    ctx.bus.emit('onAttack', { tags: atk.tags, targets, x: p.x, y: p.y, angle, repeat });

    if (!repeat && Math.random() < p.stats.get('repeatChance')) this.repeats.push(0.14);
    return true;
  }
}
