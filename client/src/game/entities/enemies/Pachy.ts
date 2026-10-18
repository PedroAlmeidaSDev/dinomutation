import type { RunContext } from '../../core/RunContext';
import type { Enemy, EnemyBehavior } from './Enemy';

type State = 'approach' | 'windup' | 'charge' | 'recover';

/** Telegraphs a straight headbutt charge, then rams through. */
export class PachyBehavior implements EnemyBehavior {
  private state: State = 'approach';
  private timer = 0;
  private angle = 0;

  update(e: Enemy, dt: number, ctx: RunContext): void {
    const p = e.def.params;
    this.timer -= dt;
    switch (this.state) {
      case 'approach':
        e.moveToward(ctx.player.x, ctx.player.y, 1, dt, ctx);
        if (e.distToPlayer(ctx) < p.triggerRange && this.timer <= 0) {
          this.state = 'windup';
          this.timer = p.windup;
          this.angle = e.angleToPlayer(ctx);
          e.trackTelegraph(ctx.telegraphs.line(e.x, e.y, this.angle, p.chargeSpeed * p.chargeTime, e.radius * 2, p.windup));
        }
        break;
      case 'windup':
        e.faceTowards(this.angle, dt, 16);
        // shake in place while preparing
        e.sprite.x += (Math.random() - 0.5) * 3;
        if (this.timer <= 0) {
          this.state = 'charge';
          this.timer = p.chargeTime;
          e.attackContactDamage = p.damage;
          e.ignoreSeparation = true;
          ctx.fx.dust(e.x, e.y, 8);
        }
        break;
      case 'charge':
        e.moveAngle(this.angle, p.chargeSpeed, dt, ctx);
        if (Math.random() < 0.4) ctx.fx.dust(e.x, e.y, 1);
        if (this.timer <= 0) this.stop(e, p.recover);
        break;
      case 'recover':
        if (this.timer <= 0) {
          this.state = 'approach';
          this.timer = 0.6;
        }
        break;
    }
  }

  onBlocked(e: Enemy, ctx: RunContext): void {
    if (this.state !== 'charge') return;
    this.stop(e, e.def.params.recover);
    ctx.status.apply(e, 'stun', { duration: 1.2 });
    ctx.fx.dust(e.x, e.y, 10);
  }

  private stop(e: Enemy, recover: number): void {
    this.state = 'recover';
    this.timer = recover;
    e.attackContactDamage = 0;
    e.ignoreSeparation = false;
  }
}
