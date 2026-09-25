import { BALANCE } from '../../data/balance';
import type { RunContext } from '../core/RunContext';
import type { Ability } from './Ability';

/** T-Rex: Rugido do Rei — knockback, stun and a temporary damage buff. */
export class RoarAbility implements Ability {
  readonly id = 'roar' as const;
  readonly name = 'Rugido do Rei';
  readonly baseCooldown = BALANCE.abilities.roar.cooldown;
  readonly tags = ['roar', 'aoe', 'stun'];

  activate(ctx: RunContext): void {
    const p = ctx.player;
    const cfg = BALANCE.abilities.roar;
    const radius = 240 * Math.sqrt(p.stats.get('size'));
    for (const e of ctx.queryEnemies(p.x, p.y, radius)) {
      if (e.dead) continue;
      ctx.damage.hitEnemy({
        target: e,
        base: p.stats.get('damage') * cfg.coef,
        tags: ['roar', 'aoe'],
        knockback: 560,
        knockAngle: Math.atan2(e.y - p.y, e.x - p.x),
        canCrit: false,
      });
      ctx.status.apply(e, 'stun', { duration: cfg.stun });
    }
    p.stats.addTimed('ability:roar', 'damage', 'mult', cfg.damageBuff, cfg.buffDuration);
    ctx.fx.ring(p.x, p.y, radius, 0xffd070, 500);
    ctx.fx.ring(p.x, p.y, radius * 0.65, 0xff8040, 380);
    ctx.fx.dust(p.x, p.y, 20);
    ctx.fx.floatText(p.x, p.y - 50, 'RUGIDO!', '#ffd070', 22);
    ctx.fx.shake(BALANCE.feel.shakeHeavy, 320);
    ctx.hitstop(BALANCE.feel.hitstopAbility);
  }
}
