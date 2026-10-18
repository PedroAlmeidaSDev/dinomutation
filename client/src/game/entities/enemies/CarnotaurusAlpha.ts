import Phaser from 'phaser';
import type { RunContext } from '../../core/RunContext';
import type { Enemy, EnemyBehavior } from './Enemy';
import { resolveCircle, resolveCone, slamFx } from './attacks';

type State = 'chase' | 'slamWindup' | 'chargeWindup' | 'charge' | 'shockWindup' | 'recover';

/**
 * Elite Carnotaurus: bigger slam, telegraphed charges that end in a shockwave.
 * Always drops a mutagen (guaranteed rare upgrade).
 */
export class CarnotaurusAlphaBehavior implements EnemyBehavior {
  private state: State = 'chase';
  private timer = 1;
  private angle = 0;
  private attacks = 0;

  onSpawn(e: Enemy, ctx: RunContext): void {
    const aura = ctx.scene.add.image(0, 0, 'glow').setTint(0xff3020).setBlendMode(Phaser.BlendModes.ADD).setScale(e.radius / 18).setAlpha(0.5);
    e.extras.add(aura);
    ctx.scene.tweens.add({ targets: aura, alpha: { from: 0.25, to: 0.65 }, scale: { from: e.radius / 20, to: e.radius / 15 }, yoyo: true, repeat: -1, duration: 600 });
    e.setBaseTint(0xff9a8a);
  }

  update(e: Enemy, dt: number, ctx: RunContext): void {
    const p = e.def.params;
    this.timer -= dt;
    const dist = e.distToPlayer(ctx);

    switch (this.state) {
      case 'chase':
        e.moveToward(ctx.player.x, ctx.player.y, 1, dt, ctx);
        if (this.timer > 0) break;
        if (this.attacks % 3 === 2 || dist > 380) this.beginCharge(e, ctx);
        else if (dist < p.attackRange + ctx.player.radius) this.beginSlam(e, ctx);
        break;
      case 'slamWindup':
        e.faceTowards(this.angle, dt, 8);
        if (this.timer <= 0) {
          resolveCone(ctx, e, this.angle, p.arc, p.reach, p.damage, 520);
          slamFx(ctx, e.x + Math.cos(this.angle) * p.reach * 0.6, e.y + Math.sin(this.angle) * p.reach * 0.6, p.reach * 0.7, 0xff5030);
          this.finishAttack(p.cooldown);
        }
        break;
      case 'chargeWindup':
        e.faceTowards(this.angle, dt, 12);
        e.sprite.x += (Math.random() - 0.5) * 4;
        if (this.timer <= 0) {
          this.state = 'charge';
          this.timer = p.chargeTime;
          e.attackContactDamage = p.chargeDamage;
          e.ignoreSeparation = true;
        }
        break;
      case 'charge':
        e.moveAngle(this.angle, p.chargeSpeed, dt, ctx);
        ctx.fx.dust(e.x, e.y, 1);
        if (this.timer <= 0) this.beginShock(e, ctx);
        break;
      case 'shockWindup':
        if (this.timer <= 0) {
          resolveCircle(ctx, e, e.x, e.y, p.shockRadius, p.shockDamage, 600);
          slamFx(ctx, e.x, e.y, p.shockRadius, 0xff3020);
          ctx.fx.shake(0.008, 200);
          this.finishAttack(p.cooldown);
        }
        break;
      case 'recover':
        if (this.timer <= 0) this.state = 'chase';
        break;
    }
  }

  onBlocked(e: Enemy, ctx: RunContext): void {
    if (this.state === 'charge') this.beginShock(e, ctx);
  }

  private beginSlam(e: Enemy, ctx: RunContext): void {
    const p = e.def.params;
    this.state = 'slamWindup';
    this.timer = p.windup;
    this.angle = e.angleToPlayer(ctx);
    e.trackTelegraph(ctx.telegraphs.cone(e.x, e.y, this.angle, p.arc, p.reach, p.windup));
  }

  private beginCharge(e: Enemy, ctx: RunContext): void {
    const p = e.def.params;
    this.state = 'chargeWindup';
    this.timer = p.chargeWindup;
    this.angle = e.angleToPlayer(ctx);
    e.trackTelegraph(ctx.telegraphs.line(e.x, e.y, this.angle, p.chargeSpeed * p.chargeTime, e.radius * 2, p.chargeWindup));
  }

  private beginShock(e: Enemy, ctx: RunContext): void {
    const p = e.def.params;
    e.attackContactDamage = 0;
    e.ignoreSeparation = false;
    this.state = 'shockWindup';
    this.timer = p.shockWindup;
    e.trackTelegraph(ctx.telegraphs.circle(e.x, e.y, p.shockRadius, p.shockWindup));
  }

  private finishAttack(cooldown: number): void {
    this.attacks++;
    this.state = 'recover';
    this.timer = cooldown;
  }
}
