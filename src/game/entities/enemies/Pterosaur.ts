import type { RunContext } from '../../core/RunContext';
import type { Enemy, EnemyBehavior } from './Enemy';

type State = 'reposition' | 'hover';

/** Flies over obstacles, keeps changing position around the player and drops rocks. */
export class PterosaurBehavior implements EnemyBehavior {
  private state: State = 'reposition';
  private timer = 0;
  private tx = 0;
  private ty = 0;
  private hasTarget = false;

  private pickSpot(e: Enemy, ctx: RunContext): void {
    const p = e.def.params;
    const a = Math.random() * Math.PI * 2;
    const r = p.orbitMin + Math.random() * (p.orbitMax - p.orbitMin);
    this.tx = ctx.player.x + Math.cos(a) * r;
    this.ty = ctx.player.y + Math.sin(a) * r;
    this.hasTarget = true;
    this.timer = 2.5;
  }

  update(e: Enemy, dt: number, ctx: RunContext): void {
    const p = e.def.params;
    this.timer -= dt;
    if (this.state === 'reposition') {
      if (!this.hasTarget) this.pickSpot(e, ctx);
      e.moveToward(this.tx, this.ty, 1, dt, ctx);
      const d = Math.hypot(this.tx - e.x, this.ty - e.y);
      if (d < 20 || this.timer <= 0) {
        this.state = 'hover';
        this.timer = p.hover;
      }
    } else {
      e.faceTowards(e.angleToPlayer(ctx), dt, 8);
      if (this.timer <= 0) {
        const angle = e.angleToPlayer(ctx);
        for (let i = 0; i < p.shots; i++) {
          const spread = (i - (p.shots - 1) / 2) * 0.2;
          ctx.projectiles.spawnEnemy({
            x: e.x, y: e.y, angle: angle + spread, speed: p.projectileSpeed,
            damage: p.damage * e.damageMult, texture: 'rock', radius: 7, attacker: e, spin: true,
          });
        }
        this.state = 'reposition';
        this.hasTarget = false;
      }
    }
  }
}
