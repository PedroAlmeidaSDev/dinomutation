import { BALANCE } from '../../data/balance';
import type { RunContext } from '../core/RunContext';
import type { Ability } from './Ability';

/** T-Rex: Rugido do Rei — knockback, stun and a temporary damage buff. */
export class RoarAbility implements Ability {
  readonly id = 'roar' as const;
  readonly name = 'Rugido do Rei';
  readonly baseCooldown = 10;
  readonly tags = ['roar', 'aoe', 'stun'];

  activate(ctx: RunContext): void {
    const p = ctx.player;
    const radius = 240 * Math.sqrt(p.stats.get('size'));
    for (const e of ctx.queryEnemies(p.x, p.y, radius)) {
      if (e.dead) continue;
      ctx.damage.hitEnemy({
        target: e,
        base: p.stats.get('damage') * 0.6,
        tags: ['roar', 'aoe'],
        knockback: 560,
        knockAngle: Math.atan2(e.y - p.y, e.x - p.x),
        canCrit: false,
      });
      ctx.status.apply(e, 'stun', { duration: 1.1 });
    }
    p.stats.addTimed('ability:roar', 'damage', 'mult', 0.4, 4);
    ctx.fx.ring(p.x, p.y, radius, 0xffd070, 500);
    ctx.fx.ring(p.x, p.y, radius * 0.65, 0xff8040, 380);
    ctx.fx.dust(p.x, p.y, 20);
    ctx.fx.floatText(p.x, p.y - 50, 'RUGIDO!', '#ffd070', 22);
    ctx.fx.shake(BALANCE.feel.shakeHeavy, 320);
    ctx.hitstop(BALANCE.feel.hitstopAbility);
  }
}
