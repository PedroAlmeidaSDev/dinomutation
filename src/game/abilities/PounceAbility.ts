import { BALANCE } from '../../data/balance';
import type { RunContext } from '../core/RunContext';
import type { Ability } from './Ability';

/** Velociraptor: Pounce — fast leap along the movement direction, shredding everything crossed. */
export class PounceAbility implements Ability {
  readonly id = 'pounce' as const;
  readonly name = 'Pounce';
  readonly baseCooldown = BALANCE.abilities.pounce.cooldown;
  readonly tags = ['dash', 'pounce', 'claw'];

  activate(ctx: RunContext): void {
    const p = ctx.player;
    const angle = p.isMoving ? p.moveAngle : p.facing;
    p.dashMomentum = p.momentum;
    ctx.bus.emit('onDash', { angle, momentum: p.momentum });
    ctx.fx.dust(p.x, p.y, 8);
    p.startDash({
      angle,
      distance: 290,
      duration: 0.2,
      hitPadding: 20,
      afterImageColor: 0xffb070,
      onHit: (e) => {
        ctx.damage.hitEnemy({
          target: e,
          base: p.stats.get('damage') * BALANCE.abilities.pounce.coef,
          tags: ['dash', 'pounce', 'claw', 'physical'],
          knockback: 120,
          knockAngle: angle + (Math.random() < 0.5 ? 1 : -1) * 1.2,
        });
        ctx.fx.claw(e.x, e.y, angle, 1, 0xffffff);
        ctx.bus.emit('onDashHit', { enemy: e });
      },
      onEnd: (x, y) => {
        ctx.bus.emit('onDashEnd', { x, y, momentum: p.dashMomentum });
        p.momentum = 0;
      },
    });
  }
}
