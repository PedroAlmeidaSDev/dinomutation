import type { RunContext } from '../../core/RunContext';
import type { Enemy, EnemyBehavior } from './Enemy';

/** Keeps its distance and spits poison. */
export class DilophosaurusBehavior implements EnemyBehavior {
  private fireTimer = 1 + Math.random() * 1.5;
  private windup = -1;
  private strafe = Math.random() < 0.5 ? 1 : -1;

  update(e: Enemy, dt: number, ctx: RunContext): void {
    const p = e.def.params;
    const dist = e.distToPlayer(ctx);
    const toPlayer = e.angleToPlayer(ctx);

    if (this.windup >= 0) {
      this.windup -= dt;
      e.faceTowards(toPlayer, dt, 12);
      e.sprite.setScale((e.def.scale ?? 1) * (1 + 0.25 * (1 - this.windup / p.windup)));
      if (this.windup < 0) {
        e.sprite.setScale(e.def.scale ?? 1);
        // Lead the target slightly.
        const lead = 0.25;
        const tx = ctx.player.x + ctx.player.vx * lead;
        const ty = ctx.player.y + ctx.player.vy * lead;
        const angle = Math.atan2(ty - e.y, tx - e.x);
        ctx.projectiles.spawnEnemy({
          x: e.x + Math.cos(angle) * e.radius,
          y: e.y + Math.sin(angle) * e.radius,
          angle,
          speed: p.projectileSpeed,
          damage: p.damage * e.damageMult,
          texture: 'spit',
          radius: 8,
          poisonStacks: p.poisonStacks,
          attacker: e,
        });
        ctx.fx.poisonPuff(e.x + Math.cos(angle) * e.radius, e.y + Math.sin(angle) * e.radius);
      }
      return;
    }

    if (dist > p.maxRange) e.moveAngle(toPlayer, e.speed, dt, ctx);
    else if (dist < p.minRange) e.moveAngle(toPlayer + Math.PI, e.speed * 0.9, dt, ctx, false);
    else e.moveAngle(toPlayer + (Math.PI / 2) * this.strafe, e.speed * 0.5, dt, ctx, false);
    e.faceTowards(toPlayer, dt, 6);

    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && dist < p.maxRange + 80) {
      this.fireTimer = p.fireInterval * (0.85 + Math.random() * 0.3);
      this.windup = p.windup;
      if (Math.random() < 0.3) this.strafe = -this.strafe;
    }
  }
}
