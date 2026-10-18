import type { RunContext } from '../../core/RunContext';
import type { Enemy, EnemyBehavior } from './Enemy';
import { resolveCone, slamFx } from './attacks';

type State = 'chase' | 'windup' | 'recover';

/** Heavy brute: slow, telegraphed frontal slam that hits very hard. */
export class CarnotaurusBehavior implements EnemyBehavior {
  protected state: State = 'chase';
  protected timer = 0;
  protected angle = 0;

  update(e: Enemy, dt: number, ctx: RunContext): void {
    const p = e.def.params;
    this.timer -= dt;
    switch (this.state) {
      case 'chase':
        e.moveToward(ctx.player.x, ctx.player.y, 1, dt, ctx);
        if (e.distToPlayer(ctx) < p.attackRange + ctx.player.radius && this.timer <= 0) this.beginSlam(e, ctx);
        break;
      case 'windup':
        e.faceTowards(this.angle, dt, 8);
        if (this.timer <= 0) {
          const ox = e.x;
          const oy = e.y;
          resolveCone(ctx, e, this.angle, p.arc, p.reach, p.damage, 420);
          slamFx(ctx, ox + Math.cos(this.angle) * p.reach * 0.6, oy + Math.sin(this.angle) * p.reach * 0.6, p.reach * 0.6);
          this.state = 'recover';
          this.timer = p.cooldown;
        }
        break;
      case 'recover':
        e.moveToward(ctx.player.x, ctx.player.y, 0.4, dt, ctx);
        if (this.timer <= 0) this.state = 'chase';
        break;
    }
  }

  protected beginSlam(e: Enemy, ctx: RunContext): void {
    const p = e.def.params;
    this.state = 'windup';
    this.timer = p.windup;
    this.angle = e.angleToPlayer(ctx);
    e.trackTelegraph(ctx.telegraphs.cone(e.x, e.y, this.angle, p.arc, p.reach, p.windup));
  }
}
