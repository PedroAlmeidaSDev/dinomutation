import { BALANCE } from '../../data/balance';
import type { RunContext } from '../core/RunContext';
import type { Ability } from './Ability';

/** Triceratops: Investida — unstoppable charge that damages, launches and stuns. */
export class ChargeAbility implements Ability {
  readonly id = 'charge' as const;
  readonly name = 'Investida';
  readonly baseCooldown = 6.5;
  readonly tags = ['dash', 'charge', 'impact', 'stun'];

  activate(ctx: RunContext): void {
    const p = ctx.player;
    const angle = p.isMoving ? p.moveAngle : p.facing;
    p.dashMomentum = p.momentum;
    ctx.bus.emit('onDash', { angle, momentum: p.momentum });
    ctx.fx.dust(p.x, p.y, 14);
    ctx.fx.shake(BALANCE.feel.shakeLight, 150);
    p.startDash({
      angle,
      distance: 430,
      duration: 0.5,
      hitPadding: 16,
      stopOnObstacle: true,
      afterImageColor: 0x9ac0ff,
      onHit: (e) => {
        // Push enemies out to the side of the charge line, like a snowplough.
        const side = Math.sign(Math.sin(Math.atan2(e.y - p.y, e.x - p.x) - angle)) || 1;
        ctx.damage.hitEnemy({
          target: e,
          base: p.stats.get('damage') * 2.6,
          tags: ['dash', 'charge', 'impact', 'physical'],
          knockback: 720,
          knockAngle: angle + side * 0.9,
        });
        ctx.status.apply(e, 'stun', { duration: 1.1 });
        ctx.fx.dust(e.x, e.y, 6);
        ctx.fx.shake(BALANCE.feel.shakeMedium, 90);
        ctx.hitstop(0.02);
        ctx.bus.emit('onDashHit', { enemy: e });
      },
      onEnd: (x, y) => {
        ctx.fx.dust(x, y, 12);
        ctx.bus.emit('onDashEnd', { x, y, momentum: p.dashMomentum });
        p.momentum = 0;
      },
    });
  }
}
