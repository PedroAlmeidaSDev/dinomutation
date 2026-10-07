import type { RunContext } from '../../core/RunContext';
import type { Enemy, EnemyBehavior } from './Enemy';

type State = 'flank' | 'windup' | 'lunge' | 'recover';

/** Circles to the player's side, then lunges in. */
export class WildRaptorBehavior implements EnemyBehavior {
  private state: State = 'flank';
  private timer = 0;
  private side = Math.random() < 0.5 ? 1 : -1;
  private lungeAngle = 0;

  update(e: Enemy, dt: number, ctx: RunContext): void {
    const p = e.def.params;
    const dist = e.distToPlayer(ctx);
    const toPlayer = e.angleToPlayer(ctx);
    this.timer -= dt;

    switch (this.state) {
      case 'flank': {
        // Aim for a point beside the player, so raptors come from the flanks.
        const offsetAngle = ctx.player.facing + (Math.PI / 2) * this.side;
        const tx = ctx.player.x + Math.cos(offsetAngle) * p.flankDistance;
        const ty = ctx.player.y + Math.sin(offsetAngle) * p.flankDistance;
        const flankWeight = dist > 420 ? 0.2 : 1;
        const fx = tx * flankWeight + ctx.player.x * (1 - flankWeight);
        const fy = ty * flankWeight + ctx.player.y * (1 - flankWeight);
        e.moveToward(fx, fy, 1, dt, ctx);
        if (dist < p.lungeRange && this.timer <= 0) {
          this.state = 'windup';
          this.timer = p.windup;
          this.lungeAngle = toPlayer;
          e.trackTelegraph(ctx.telegraphs.line(e.x, e.y, toPlayer, p.lungeSpeed * p.lungeTime, e.radius * 1.6, p.windup, 0xff7a3a));
        }
        break;
      }
      case 'windup':
        e.faceTowards(this.lungeAngle, dt, 20);
        if (this.timer <= 0) {
          this.state = 'lunge';
          this.timer = p.lungeTime;
          e.attackContactDamage = p.lungeDamage;
        }
        break;
      case 'lunge':
        e.moveAngle(this.lungeAngle, p.lungeSpeed, dt, ctx);
        if (this.timer <= 0) {
          this.state = 'recover';
          this.timer = p.cooldown;
          e.attackContactDamage = 0;
          this.side = -this.side;
        }
        break;
      case 'recover':
        e.moveAngle(toPlayer + (Math.PI / 2) * this.side, e.speed * 0.7, dt, ctx);
        if (this.timer <= 0) this.state = 'flank';
        break;
    }
  }
}
